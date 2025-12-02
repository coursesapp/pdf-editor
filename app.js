class PDFEditor {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.zoom = 1.0;
        this.annotations = [];
        // History stack for undo
        this.history = [];
        this.maxHistory = 50;
        this.currentTool = 'select';

        // Global defaults (kept for backward compatibility)
        this.currentColor = '#ff0000';
        this.currentSize = 3;

        // Per-tool settings
        this.textColor = '#ff0000';
        this.textSize = 3;

        this.drawColor = '#ff0000';
        this.drawSize = 3;

        this.highlightColor = '#ffff00';
        this.highlightOpacity = 0.3;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.pdfLibDoc = null;
        this.db = null;
        this.draggingAnnotation = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // For editing a specific text annotation via modal
        this.editingTextAnnotation = null;
        // For editing a specific image annotation via modal
        this.editingImageAnnotation = null;
        // Cache for image objects used in annotations
        this.imageCache = new Map();
        
        this.initializeElements();
        this.attachEventListeners();
        this.initDB().then(() => this.loadSavedData());
    }

    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('pdfEditorDB', 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('pdfFiles')) {
                    const store = db.createObjectStore('pdfFiles', { keyPath: 'fileName' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = () => {
                console.error('IndexedDB init error:', request.error);
                reject(request.error);
            };
        });
    }

    initializeElements() {
        this.fileInput = document.getElementById('fileInput');
        this.saveBtn = document.getElementById('saveBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.pdfContainer = document.getElementById('pdfContainer');
        this.toolbar = document.getElementById('toolbar');
        this.viewerControls = document.getElementById('viewerControls');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.pageInfo = document.getElementById('pageInfo');
        this.zoomInput = document.getElementById('zoomInput');
        this.statusBar = document.getElementById('statusBar');
        this.statusText = document.getElementById('statusText');
        this.toolButtons = document.querySelectorAll('.tool-btn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.openTextSettingsBtn = document.getElementById('openTextSettings');
        this.textSettingsModal = document.getElementById('textSettingsModal');
        this.textContentInput = document.getElementById('textContentInput');
        this.textColorInput = document.getElementById('textColorInput');
        this.textSizeInput = document.getElementById('textSizeInput');
        this.textSizeValue = document.getElementById('textSizeValue');
        this.closeTextSettingsBtn = document.getElementById('closeTextSettings');
        this.applyTextSettingsBtn = document.getElementById('applyTextSettings');

        // Draw settings modal elements
        this.openDrawSettingsBtn = document.getElementById('openDrawSettings');
        this.drawSettingsModal = document.getElementById('drawSettingsModal');
        this.drawColorInput = document.getElementById('drawColorInput');
        this.drawSizeInput = document.getElementById('drawSizeInput');
        this.drawSizeValue = document.getElementById('drawSizeValue');
        this.closeDrawSettingsBtn = document.getElementById('closeDrawSettings');
        this.applyDrawSettingsBtn = document.getElementById('applyDrawSettings');

        // Highlight settings modal elements
        this.openHighlightSettingsBtn = document.getElementById('openHighlightSettings');
        this.highlightSettingsModal = document.getElementById('highlightSettingsModal');
        this.highlightColorInput = document.getElementById('highlightColorInput');
        this.highlightOpacityInput = document.getElementById('highlightOpacityInput');
        this.highlightOpacityValue = document.getElementById('highlightOpacityValue');
        this.closeHighlightSettingsBtn = document.getElementById('closeHighlightSettings');
        this.applyHighlightSettingsBtn = document.getElementById('applyHighlightSettings');

        // Image settings elements
        // this.openImageSettingsBtn = document.getElementById('openImageSettings');
        this.imageSettingsModal = document.getElementById('imageSettingsModal');
        this.imageFileInput = document.getElementById('imageFileInput');
        this.imageScaleInput = document.getElementById('imageScaleInput');
        this.imageScaleValue = document.getElementById('imageScaleValue');
        this.closeImageSettingsBtn = document.getElementById('closeImageSettings');
        this.applyImageSettingsBtn = document.getElementById('applyImageSettings');

        // Undo button
        this.undoBtn = document.getElementById('undoBtn');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.loadPDF(e.target.files[0]));
        this.saveBtn.addEventListener('click', () => this.savePDF());
        this.clearBtn.addEventListener('click', () => this.clearAnnotations());
        this.prevPageBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextPageBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.zoomInput.addEventListener('change', (e) => this.setZoom(parseInt(e.target.value) / 100));
        
        this.toolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(e.target.dataset.tool);
            });
        });

        if (this.openTextSettingsBtn) {
            this.openTextSettingsBtn.addEventListener('click', () => {
                this.openTextSettings(null);
            });
        }
        if (this.closeTextSettingsBtn) {
            this.closeTextSettingsBtn.addEventListener('click', () => {
                this.closeTextSettings();
            });
        }
        if (this.applyTextSettingsBtn) {
            this.applyTextSettingsBtn.addEventListener('click', () => {
                this.applyTextSettings();
            });
        }
        // تحديث عرض قيمة حجم النص أثناء تحريك السلايدر داخل المودال
        if (this.textSizeInput && this.textSizeValue) {
            this.textSizeInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                    this.textSizeValue.textContent = val;
                }
            });
        }

        // Draw settings modal
        if (this.openDrawSettingsBtn) {
            this.openDrawSettingsBtn.addEventListener('click', () => {
                this.openDrawSettings();
            });
        }
        if (this.closeDrawSettingsBtn) {
            this.closeDrawSettingsBtn.addEventListener('click', () => {
                this.closeDrawSettings();
            });
        }
        if (this.applyDrawSettingsBtn) {
            this.applyDrawSettingsBtn.addEventListener('click', () => {
                this.applyDrawSettings();
            });
        }
        // تحديث عرض قيمة حجم الرسم أثناء تحريك السلايدر داخل المودال
        if (this.drawSizeInput && this.drawSizeValue) {
            this.drawSizeInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                    this.drawSizeValue.textContent = val;
                }
            });
        }

        // Highlight settings modal
        if (this.openHighlightSettingsBtn) {
            this.openHighlightSettingsBtn.addEventListener('click', () => {
                this.openHighlightSettings();
            });
        }
        if (this.closeHighlightSettingsBtn) {
            this.closeHighlightSettingsBtn.addEventListener('click', () => {
                this.closeHighlightSettings();
            });
        }
        if (this.applyHighlightSettingsBtn) {
            this.applyHighlightSettingsBtn.addEventListener('click', () => {
                this.applyHighlightSettings();
            });
        }
        // تحديث عرض قيمة الـ opacity أثناء تحريك السلايدر داخل المودال
        if (this.highlightOpacityInput && this.highlightOpacityValue) {
            this.highlightOpacityInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    this.highlightOpacityValue.textContent = val.toFixed(1);
                }
            });
        }

        // Image settings modal
        // if (this.openImageSettingsBtn) {
        //     this.openImageSettingsBtn.addEventListener('click', () => {
        //         this.openImageSettings(null);
        //     });
        // }
        if (this.closeImageSettingsBtn) {
            this.closeImageSettingsBtn.addEventListener('click', () => {
                this.closeImageSettings();
            });
        }
        if (this.applyImageSettingsBtn) {
            this.applyImageSettingsBtn.addEventListener('click', () => {
                this.applyImageSettings();
            });
        }
        // تحديث عرض قيمة الـ scale للصورة أثناء تحريك السلايدر داخل المودال
        if (this.imageScaleInput && this.imageScaleValue) {
            this.imageScaleInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    this.imageScaleValue.textContent = val.toFixed(1);
                }
            });
        }

        // Undo button
        if (this.undoBtn) {
            this.undoBtn.addEventListener('click', () => {
                this.undoLastAction();
            });
        }

        // Prevent right-click context menu (prevents download)
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.pdf-container')) {
                e.preventDefault();
            }
        });

        // Prevent common download shortcuts + add Undo shortcut
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z → Undo
            if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                this.undoLastAction();
                return;
            }

            // Prevent Ctrl+S (save as), Ctrl+P (print), F12 (dev tools)
            if ((e.ctrlKey && (e.key === 's' || e.key === 'p')) || e.key === 'F12') {
                e.preventDefault();
                if (e.key === 's' && e.ctrlKey) {
                    this.savePDF();
                }
            }
        });
    }

    async loadPDF(file) {
        if (!file) return;

        this.showLoading(true, 'Loading PDF...');
        
        try {
            // Ensure libraries are loaded
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js library not loaded');
            }
            if (typeof PDFLib === 'undefined') {
                throw new Error('PDF-lib library not loaded');
            }

            this.fileName = file.name;

            // افتراضياً نستخدم الملف الذي اختاره المستخدم
            let arrayBuffer = await file.arrayBuffer();
            let annotations = [];
            let currentPage = 1;
            let zoom = 1.0;

            // لو في نسخة محفوظة لنفس الاسم في IndexedDB نستخدمها بدلاً من الملف الخام
            const stored = await this.getFromIndexedDB(this.fileName);
            console.log(stored);
            if (stored) {
                arrayBuffer = stored.pdfData;
                annotations = stored.annotations || [];
                currentPage = stored.currentPage || 1;
                zoom = stored.zoom || 1.0;
            }

            this.annotations = annotations;
            this.currentPage = currentPage;
            this.zoom = zoom;

            // Create a copy of the ArrayBuffer for pdf-lib to avoid detachment issues
            const arrayBufferCopy = arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer;
            
            // Load with PDF.js for rendering
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;

            // Load with pdf-lib for editing (using the copy)
            this.pdfLibDoc = await PDFLib.PDFDocument.load(arrayBufferCopy);
            
            // Show UI elements
            this.toolbar.style.display = 'flex';
            this.viewerControls.style.display = 'flex';
            this.statusBar.style.display = 'block';
            this.saveBtn.disabled = false;
            this.clearBtn.disabled = false;

            // Render pages
            await this.renderPages();
            this.goToPage(this.currentPage);
            
            this.showLoading(false);
            this.updateStatus('PDF loaded successfully');
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.showLoading(false);
            this.updateStatus('Error loading PDF: ' + error.message);
        }
    }

    async renderPages() {
        this.pdfContainer.innerHTML = '';
        this.pdfContainer.classList.remove('placeholder');

        for (let i = 1; i <= this.totalPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: this.zoom });

            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page';
            pageDiv.dataset.pageNumber = i;

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Create annotation layer
            const annotationLayer = document.createElement('canvas');
            annotationLayer.className = 'annotation-layer';
            annotationLayer.width = viewport.width;
            annotationLayer.height = viewport.height;
            annotationLayer.style.width = viewport.width + 'px';
            annotationLayer.style.height = viewport.height + 'px';

            pageDiv.appendChild(canvas);
            pageDiv.appendChild(annotationLayer);

            // Attach drawing events
            this.attachDrawingEvents(annotationLayer, i);

            this.pdfContainer.appendChild(pageDiv);
        }

        this.renderAnnotations();
        this.updatePageInfo();
    }

    attachDrawingEvents(canvas, pageNum) {
        const ctx = canvas.getContext('2d');
        
        const handlePointerDown = (e) => {
            const { x, y } = this.getEventPosition(e, canvas);
            this.startX = x;
            this.startY = y;
            
            // مسح في وضع erase
            if (this.currentTool === 'erase') {
                this.pushHistory();
                this.eraseAt(pageNum, this.startX, this.startY, ctx);
                return;
            }

            // تحريك النص / الصورة في وضع select
            if (this.currentTool === 'select') {
                const hit = this.findMovableAnnotationAt(pageNum, this.startX, this.startY, ctx);
                if (hit) {
                    this.pushHistory();
                    this.draggingAnnotation = hit;
                    this.dragOffsetX = this.startX - hit.data.x;
                    this.dragOffsetY = this.startY - hit.data.y;
                }
                return;
            }

            // إضافة صورة
            if (this.currentTool === 'image') {
                this.addImageAnnotation(e, canvas, pageNum);
                return;
            }

            this.isDrawing = true;

            if (this.currentTool === 'text') {
                this.addTextAnnotation(e, canvas, pageNum);
            }
        };

        const handlePointerMove = (e) => {
            const { x: currentX, y: currentY } = this.getEventPosition(e, canvas);

            // مسح متكرر أثناء السحب
            if (this.currentTool === 'erase') {
                this.eraseAt(pageNum, currentX, currentY, ctx);
                return;
            }

            // سحب النص/الصورة في وضع select
            if (this.currentTool === 'select' && this.draggingAnnotation) {
                const ann = this.draggingAnnotation;
                ann.data.x = currentX - this.dragOffsetX;
                ann.data.y = currentY - this.dragOffsetY;
                this.renderAnnotations();
                return;
            }

            if (!this.isDrawing || this.currentTool === 'text') return;

            if (this.currentTool === 'draw') {
                // ارسم الجزء الحالي
                this.drawLine(ctx, this.startX, this.startY, currentX, currentY, this.drawColor, this.drawSize);
                // خزّن هذا الجزء كـ annotation عشان يرجع بعد إعادة الفتح
                this.saveAnnotation('draw', pageNum, {
                    type: 'line',
                    startX: this.startX,
                    startY: this.startY,
                    endX: currentX,
                    endY: currentY,
                    color: this.drawColor,
                    size: this.drawSize
                });
                // حدّث نقطة البداية للجزء اللي بعده
                this.startX = currentX;
                this.startY = currentY;
            } else if (this.currentTool === 'highlight') {
                // Preview للـ highlight أثناء السحب
                this.renderAnnotations();
                const previewX = Math.min(this.startX, currentX);
                const previewY = Math.min(this.startY, currentY);
                const previewW = Math.abs(currentX - this.startX);
                const previewH = Math.abs(currentY - this.startY);
                ctx.save();
                ctx.fillStyle = this.highlightColor;
                ctx.globalAlpha = this.highlightOpacity;
                ctx.fillRect(previewX, previewY, previewW, previewH);
                ctx.restore();
            }
        };

        const handlePointerUp = (e) => {
            // إنهاء سحب النص/الصورة + دعم فتح إعدادات عند الضغط بدون سحب
            if (this.currentTool === 'select' && this.draggingAnnotation) {
                const { x: endX, y: endY } = this.getEventPosition(e, canvas);
                const moveDistance = Math.hypot(endX - this.startX, endY - this.startY);

                const ann = this.draggingAnnotation;
                this.draggingAnnotation = null;

                // لو الضغط كان مجرد نقرة خفيفة (من غير سحب كبير) افتح نافذة الإعدادات المناسبة
                if (moveDistance < 5) {
                    if (ann.type === 'text') {
                        this.openTextSettings(ann);
                        return;
                    }
                    if (ann.type === 'image') {
                        this.openImageSettings(ann);
                        return;
                    }
                }

                return;
            }

            if (!this.isDrawing) return;

            const { x: endX, y: endY } = this.getEventPosition(e, canvas);

            if (this.currentTool === 'highlight') {
                this.saveAnnotation('highlight', pageNum, {
                    type: 'rectangle',
                    x: Math.min(this.startX, endX),
                    y: Math.min(this.startY, endY),
                    width: Math.abs(endX - this.startX),
                    height: Math.abs(endY - this.startY),
                    color: this.highlightColor,
                    opacity: this.highlightOpacity
                });
                // أعد رسم الـ annotations عشان الـ highlight يظهر فورًا
                this.renderAnnotations();
            }

            this.isDrawing = false;
        };

        const handlePointerLeave = () => {
            this.isDrawing = false;
            this.draggingAnnotation = null;
        };

        // Mouse events
        canvas.addEventListener('mousedown', handlePointerDown);
        canvas.addEventListener('mousemove', handlePointerMove);
        canvas.addEventListener('mouseup', handlePointerUp);
        canvas.addEventListener('mouseleave', handlePointerLeave);

        // Touch events (for mobile)
        canvas.addEventListener('touchstart', (e) => {
            // استدعاء منطق الضغط المشترك
            handlePointerDown(e);

            // امنع التمرير فقط في أدوات الرسم/المسح أو عند بدء سحب نص
            if (this.currentTool !== 'select' || this.draggingAnnotation) {
                e.preventDefault();
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            // استدعاء منطق التحريك المشترك
            handlePointerMove(e);

            // لو بنرسم/نمسح أو بنسحب عنصر امنع التمرير، غير كده اسمح بالتمرير
            if (this.isDrawing || this.currentTool === 'erase' || this.draggingAnnotation) {
                e.preventDefault();
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            // استدعاء منطق الإفلات المشترك
            handlePointerUp(e);
            // مش لازم نمنع التمرير هنا
        }, { passive: false });

        canvas.addEventListener('touchcancel', (e) => {
            handlePointerLeave(e);
            // مش لازم نمنع التمرير هنا
        }, { passive: false });
    }

    drawLine(ctx, x1, y1, x2, y2, color, size) {
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    addTextAnnotation(e, canvas, pageNum) {
        const text = prompt('Enter text:');
        if (!text) {
            this.isDrawing = false;
            return;
        }

        const { x, y } = this.getEventPosition(e, canvas);

        const ctx = canvas.getContext('2d');
        const fontSize = this.textSize * 5;
        ctx.font = `${fontSize}px Arial`;
        const metrics = ctx.measureText(text);
        const width = metrics.width;
        const height = fontSize;

        this.saveAnnotation('text', pageNum, {
            type: 'text',
            text: text,
            x: x,
            y: y,
            color: this.textColor,
            size: this.textSize,
            width,
            height
        });

        // أعد الرسم بالكامل من annotations فقط (من غير ما أسيب نص ثابت قديم)
        this.renderAnnotations();

        this.isDrawing = false;
    }

    addImageAnnotation(event, canvas, pageNum) {
        // افتح إعدادات الصورة لإضافة صورة جديدة في موضع الضغط
        const position = this.getEventPosition(event, canvas);
        this.pendingImagePosition = { pageNum, x: position.x, y: position.y };
        this.openImageSettings(null);
    }

    saveAnnotation(type, pageNum, data) {
        this.pushHistory();
        this.annotations.push({
            type: type,
            page: pageNum,
            data: data,
            id: Date.now() + Math.random()
        });
    }

    findMovableAnnotationAt(pageNum, x, y, ctx) {
        // يسمح بتحريك النص والصور
        const pageAnnotations = this.annotations.filter(
            a => a.page === pageNum && (a.type === 'text' || a.type === 'image')
        );

        for (const ann of pageAnnotations) {
            const d = ann.data;

            if (d.type === 'text') {
                const size = (d.size || this.currentSize) * 5;
                let width = d.width;
                let height = d.height || size;

                if (!width) {
                    ctx.font = `${size}px Arial`;
                    width = ctx.measureText(d.text || '').width;
                }

                const left = d.x;
                const top = d.y - height;
                const right = left + width;
                const bottom = d.y;

                if (x >= left && x <= right && y >= top && y <= bottom) {
                    return ann;
                }
            } else if (d.type === 'image') {
                const left = d.x;
                const top = d.y;
                const right = left + d.width;
                const bottom = top + d.height;

                if (x >= left && x <= right && y >= top && y <= bottom) {
                    return ann;
                }
            }
        }

        return null;
    }

    findTextAnnotationAt(pageNum, x, y, ctx) {
        const pageAnnotations = this.annotations.filter(
            a => a.page === pageNum && a.type === 'text'
        );

        for (const ann of pageAnnotations) {
            const d = ann.data;
            const size = (d.size || this.currentSize) * 5;
            let width = d.width;
            let height = d.height || size;

            // لو العرض مش متخزن (annotations قديمة) نحسبه
            if (!width) {
                ctx.font = `${size}px Arial`;
                width = ctx.measureText(d.text || '').width;
            }

            const left = d.x;
            const top = d.y - height;
            const right = left + width;
            const bottom = d.y;

            if (x >= left && x <= right && y >= top && y <= bottom) {
                return ann;
            }
        }

        return null;
    }

    eraseAt(pageNum, x, y, ctx) {
        const hitIndex = this.findAnnotationIndexAt(pageNum, x, y, ctx);
        if (hitIndex === -1) return;
        this.pushHistory();
        this.annotations.splice(hitIndex, 1);
        this.renderAnnotations();
    }

    findAnnotationIndexAt(pageNum, x, y, ctx) {
        for (let i = 0; i < this.annotations.length; i++) {
            const ann = this.annotations[i];
            if (ann.page !== pageNum) continue;
            const d = ann.data;

            if (d.type === 'text') {
                const size = (d.size || this.currentSize) * 5;
                let width = d.width;
                let height = d.height || size;
                if (!width) {
                    ctx.font = `${size}px Arial`;
                    width = ctx.measureText(d.text || '').width;
                }
                const left = d.x;
                const top = d.y - height;
                const right = left + width;
                const bottom = d.y;
                if (x >= left && x <= right && y >= top && y <= bottom) {
                    return i;
                }
            } else if (d.type === 'rectangle') {
                if (x >= d.x && x <= d.x + d.width && y >= d.y && y <= d.y + d.height) {
                    return i;
                }
            } else if (d.type === 'line') {
                const dist = this.pointToSegmentDistance(x, y, d.startX, d.startY, d.endX, d.endY);
                const threshold = (d.size || this.currentSize) * 2;
                if (dist <= threshold) {
                    return i;
                }
            } else if (d.type === 'image') {
                const left = d.x;
                const top = d.y;
                const right = left + d.width;
                const bottom = top + d.height;
                if (x >= left && x <= right && y >= top && y <= bottom) {
                    return i;
                }
            }
        }
        return -1;
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) {
            // نقطة واحدة
            return Math.hypot(px - x1, py - y1);
        }
        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        const clampedT = Math.max(0, Math.min(1, t));
        const cx = x1 + clampedT * dx;
        const cy = y1 + clampedT * dy;
        return Math.hypot(px - cx, py - cy);
    }

    getEventPosition(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        let clientX;
        let clientY;

        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        // نعوّض فرق الـ scale بين حجم الكانفس الفعلي وحجمه على الشاشة (خاصة في الموبايل مع width: 100%)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    renderAnnotations() {
        const pages = document.querySelectorAll('.pdf-page');
        pages.forEach((pageDiv, index) => {
            const pageNum = index + 1;
            const canvas = pageDiv.querySelector('.annotation-layer');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const pageAnnotations = this.annotations.filter(a => a.page === pageNum);
            pageAnnotations.forEach(annotation => {
                const { data } = annotation;
                ctx.strokeStyle = data.color || this.currentColor;
                ctx.fillStyle = data.color || this.currentColor;
                ctx.lineWidth = data.size || this.currentSize;

                if (data.type === 'line') {
                    ctx.beginPath();
                    ctx.moveTo(data.startX, data.startY);
                    ctx.lineTo(data.endX, data.endY);
                    ctx.stroke();
                } else if (data.type === 'rectangle') {
                    const opacity = typeof data.opacity === 'number' ? data.opacity : this.highlightOpacity;
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    ctx.fillRect(data.x, data.y, data.width, data.height);
                    ctx.restore();
                } else if (data.type === 'text') {
                    ctx.font = `${(data.size || 3) * 5}px Arial`;
                    ctx.fillText(data.text, data.x, data.y);
                } else if (data.type === 'image' && data.src) {
                    let img = this.imageCache.get(data.src);
                    if (!img) {
                        img = new Image();
                        img.onload = () => {
                            // أعد الرسم بعد تحميل الصورة
                            this.renderAnnotations();
                        };
                        img.src = data.src;
                        this.imageCache.set(data.src, img);
                    }
                    if (img.complete && img.naturalWidth > 0) {
                        const w = data.width || data.originalWidth || img.naturalWidth;
                        const h = data.height || data.originalHeight || img.naturalHeight;
                        ctx.drawImage(img, data.x, data.y, w, h);
                    }
                }
            });
        });
    }

    pushHistory() {
        try {
            const snapshot = JSON.parse(JSON.stringify(this.annotations));
            this.history.push(snapshot);
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }
        } catch (e) {
            console.error('Failed to push history snapshot', e);
        }
    }

    undoLastAction() {
        if (!this.history || this.history.length === 0) {
            this.updateStatus('Nothing to undo');
            return;
        }
        const previous = this.history.pop();
        this.annotations = previous || [];
        this.renderAnnotations();
        this.updateStatus('Last action undone');
    }

    setTool(tool) {
        this.currentTool = tool;
        this.toolButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    async generateThumbnails() {
        // Sidebar removed – thumbnails no longer needed
        return;
    }

    goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return;
        
        this.currentPage = pageNum;
        const pageElement = document.querySelector(`.pdf-page[data-page-number="${pageNum}"]`);
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        this.updatePageInfo();
    }

    setZoom(zoom) {
        this.zoom = zoom;
        this.zoomInput.value = Math.round(zoom * 100);
        this.renderPages();
    }

    updatePageInfo() {
        this.pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }

    clearAnnotations() {
        if (confirm('Are you sure you want to clear all annotations?')) {
            this.pushHistory();
            this.annotations = [];
            this.renderAnnotations();
            this.updateStatus('All annotations cleared');
        }
    }

    async savePDF() {
        if (!this.pdfLibDoc) {
            this.updateStatus('No PDF loaded');
            return;
        }

        this.updateStatus('Saving PDF...');

        try {
            // من دلوقتي مش هنرسم الـ annotations جوه الـ PDF نفسه
            // هنعتبر إن الـ PDF الأصلي ثابت، والكتابة/الرسم كلها في طبقة annotations فقط.

            // احفظ نسخة من الـ PDF الحالي (بدون إضافة نصوص جديدة عليه)
            const pdfBytes = await this.pdfLibDoc.save();

            await this.saveToIndexedDB({
                fileName: this.fileName,
                pdfData: pdfBytes,
                annotations: this.annotations,
                currentPage: this.currentPage,
                zoom: this.zoom,
                timestamp: Date.now()
            });

            this.updateStatus('PDF saved successfully! (Saved in IndexedDB, not downloaded)');
            
            // Show success message
            setTimeout(() => {
                this.updateStatus('Ready');
            }, 3000);

        } catch (error) {
            console.error('Error saving PDF:', error);
            this.updateStatus('Error saving PDF: ' + error.message);
        }
    }

    saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB not initialized'));
                return;
            }
            const tx = this.db.transaction('pdfFiles', 'readwrite');
            const store = tx.objectStore('pdfFiles');
            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    getFromIndexedDB(fileName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }
            const tx = this.db.transaction('pdfFiles', 'readonly');
            const store = tx.objectStore('pdfFiles');
            const request = store.get(fileName);

            request.onsuccess = () => {
                resolve(request.result || null);
            };
            request.onerror = () => {
                console.error('IndexedDB get error:', request.error);
                resolve(null);
            };
        });
    }

    loadSavedData() {
        if (!this.db) return;

        const tx = this.db.transaction('pdfFiles', 'readonly');
        const store = tx.objectStore('pdfFiles');
        const request = store.getAll();

        request.onsuccess = async () => {
            const items = request.result;
            if (!items || items.length === 0) return;

            // Load latest saved file
            items.sort((a, b) => b.timestamp - a.timestamp);
            const last = items[0];

            try {
                this.showLoading(true, 'Loading last saved PDF...');
                this.annotations = last.annotations || [];
                this.currentPage = last.currentPage || 1;
                this.zoom = last.zoom || 1.0;

                // Render PDF from stored bytes
                const arrayBuffer = last.pdfData;

                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                this.pdfDoc = await loadingTask.promise;
                this.totalPages = this.pdfDoc.numPages;

                this.pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer.slice(0));
                this.fileName = last.fileName || 'LastSaved.pdf';

                this.toolbar.style.display = 'flex';
                this.viewerControls.style.display = 'flex';
                this.statusBar.style.display = 'block';
                this.saveBtn.disabled = false;
                this.clearBtn.disabled = false;

                await this.renderPages();
                this.goToPage(this.currentPage);
                this.updateStatus('Loaded last saved PDF from IndexedDB');
                this.showLoading(false);
            } catch (error) {
                console.error('Error loading from IndexedDB:', error);
                this.showLoading(false);
            }
        };

        request.onerror = () => {
            console.error('IndexedDB read error:', request.error);
        };
    }

    updateStatus(message) {
        this.statusText.textContent = message;
    }

    showLoading(show, text) {
        if (!this.loadingOverlay) return;
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
        if (text) {
            const p = this.loadingOverlay.querySelector('p');
            if (p) p.textContent = text;
        }
    }

    openTextSettings(annotation) {
        if (!this.textSettingsModal) return;

        this.editingTextAnnotation = annotation || null;

        // مزامنة القيم الحالية
        if (this.editingTextAnnotation) {
            const d = this.editingTextAnnotation.data;
            if (this.textContentInput) this.textContentInput.value = d.text || '';
            if (this.textColorInput) this.textColorInput.value = d.color || this.textColor;
            if (this.textSizeInput) {
                const size = d.size || this.textSize;
                this.textSizeInput.value = size;
                if (this.textSizeValue) this.textSizeValue.textContent = size;
            }
        } else {
            if (this.textContentInput) this.textContentInput.value = '';
            if (this.textColorInput) this.textColorInput.value = this.textColor;
            if (this.textSizeInput) {
                this.textSizeInput.value = this.textSize;
                if (this.textSizeValue) this.textSizeValue.textContent = this.textSize;
            }
        }

        this.textSettingsModal.style.display = 'flex';
    }

    closeTextSettings() {
        if (!this.textSettingsModal) return;
        this.textSettingsModal.style.display = 'none';
        this.editingTextAnnotation = null;
    }

    applyTextSettings() {
        const color = this.textColorInput ? this.textColorInput.value : this.textColor;
        const sizeInputVal = this.textSizeInput ? parseInt(this.textSizeInput.value, 10) : this.textSize;
        const size = !isNaN(sizeInputVal) ? sizeInputVal : this.textSize;
        const content = this.textContentInput ? this.textContentInput.value : '';

        if (this.editingTextAnnotation) {
            this.pushHistory();
            const ann = this.editingTextAnnotation;
            const d = ann.data;

            d.color = color;
            d.size = size;

            if (content.trim() !== '') {
                d.text = content;
            }

            // إعادة حساب العرض والارتفاع بناءً على النص والحجم الجديدين
            const fontSize = size * 5;
            const tmpCanvas = document.createElement('canvas');
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.font = `${fontSize}px Arial`;
            const metrics = tmpCtx.measureText(d.text || '');
            d.width = metrics.width;
            d.height = fontSize;

            this.renderAnnotations();
        } else {
            // تحديث الإعدادات الافتراضية للنص
            this.textColor = color;
            this.textSize = size;
        }

        this.closeTextSettings();
    }

    openDrawSettings() {
        if (!this.drawSettingsModal) return;
        if (this.drawColorInput) this.drawColorInput.value = this.drawColor;
        if (this.drawSizeInput) {
            this.drawSizeInput.value = this.drawSize;
            if (this.drawSizeValue) this.drawSizeValue.textContent = this.drawSize;
        }
        this.drawSettingsModal.style.display = 'flex';
    }

    closeDrawSettings() {
        if (!this.drawSettingsModal) return;
        this.drawSettingsModal.style.display = 'none';
    }

    applyDrawSettings() {
        if (this.drawColorInput) this.drawColor = this.drawColorInput.value;
        if (this.drawSizeInput) {
            const sizeVal = parseInt(this.drawSizeInput.value, 10);
            if (!isNaN(sizeVal)) {
                this.drawSize = sizeVal;
                if (this.drawSizeValue) this.drawSizeValue.textContent = this.drawSize;
            }
        }
        this.closeDrawSettings();
    }

    openHighlightSettings() {
        if (!this.highlightSettingsModal) return;
        if (this.highlightColorInput) this.highlightColorInput.value = this.highlightColor;
        if (this.highlightOpacityInput) {
            this.highlightOpacityInput.value = this.highlightOpacity;
            if (this.highlightOpacityValue) this.highlightOpacityValue.textContent = this.highlightOpacity.toFixed(1);
        }
        this.highlightSettingsModal.style.display = 'flex';
    }

    closeHighlightSettings() {
        if (!this.highlightSettingsModal) return;
        this.highlightSettingsModal.style.display = 'none';
    }

    applyHighlightSettings() {
        if (this.highlightColorInput) this.highlightColor = this.highlightColorInput.value;
        if (this.highlightOpacityInput) {
            const opVal = parseFloat(this.highlightOpacityInput.value);
            if (!isNaN(opVal)) {
                this.highlightOpacity = opVal;
                if (this.highlightOpacityValue) this.highlightOpacityValue.textContent = this.highlightOpacity.toFixed(1);
            }
        }
        this.closeHighlightSettings();
    }

    openImageSettings(annotation) {
        if (!this.imageSettingsModal) return;

        this.editingImageAnnotation = annotation || null;

        if (this.imageScaleInput && this.imageScaleValue) {
            this.imageScaleInput.value = '1';
            this.imageScaleValue.textContent = '1.0';
        }

        // عند فتح الإعدادات من أجل صورة موجودة، لا نفرض اختيار صورة جديدة
        if (this.imageFileInput) {
            this.imageFileInput.value = '';
        }

        this.imageSettingsModal.style.display = 'flex';
    }

    closeImageSettings() {
        if (!this.imageSettingsModal) return;
        this.imageSettingsModal.style.display = 'none';
        this.editingImageAnnotation = null;
        this.pendingImagePosition = null;
    }

    applyImageSettings() {
        const scaleInputVal = this.imageScaleInput ? parseFloat(this.imageScaleInput.value) : 1;
        const scale = !isNaN(scaleInputVal) ? scaleInputVal : 1;

        const file = this.imageFileInput ? this.imageFileInput.files[0] : null;

        if (this.editingImageAnnotation) {
            // تعديل صورة موجودة (تغيير الحجم فقط حالياً)
            this.pushHistory();
            const ann = this.editingImageAnnotation;
            const d = ann.data;

            const baseW = d.originalWidth || d.width;
            const baseH = d.originalHeight || d.height;

            d.width = baseW * scale;
            d.height = baseH * scale;

            this.renderAnnotations();
            this.closeImageSettings();
            return;
        }

        // إنشاء صورة جديدة في الموضع المحدد
        if (!file || !this.pendingImagePosition) {
            this.closeImageSettings();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target.result;
            const img = new Image();
            img.onload = () => {
                const baseW = img.naturalWidth;
                const baseH = img.naturalHeight;

                const width = baseW * scale;
                const height = baseH * scale;

                const { pageNum, x, y } = this.pendingImagePosition;

                this.saveAnnotation('image', pageNum, {
                    type: 'image',
                    src,
                    x,
                    y,
                    width,
                    height,
                    originalWidth: baseW,
                    originalHeight: baseH
                });

                this.renderAnnotations();
                this.closeImageSettings();
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    }
}

// Initialize the PDF Editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initialize PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    new PDFEditor();
});

// Prevent drag and drop file download
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        const fileInput = document.getElementById('fileInput');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(files[0]);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
    }
});

