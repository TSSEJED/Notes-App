document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const notesGrid = document.getElementById('notes-grid');
    const noteEditor = document.getElementById('note-editor');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const notePreview = document.getElementById('note-preview');
    const noteTags = document.getElementById('note-tags');
    const addNoteBtn = document.getElementById('add-note-btn');
    const saveNoteBtn = document.getElementById('save-note');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const pinNoteBtn = document.getElementById('pin-note');
    const previewToggle = document.getElementById('preview-toggle');
    const searchInput = document.getElementById('search-notes');
    const filterCategory = document.getElementById('filter-category');
    const customAlert = document.getElementById('custom-alert');
    const alertOkBtn = document.getElementById('alert-ok-btn');
    const editorToolbar = document.querySelector('.editor-toolbar');

    // State
    let notes = JSON.parse(localStorage.getItem('hiddenDevNotes')) || [];
    let currentNoteId = null;
    let isEditing = false;
    let isPreviewMode = false;
    let autoSaveTimer = null;
    const AUTO_SAVE_DELAY = 2000; // 2 seconds

    // Initialize the app
    function init() {
        renderNotes();
        setupEventListeners();
        setupRightClickProtection();
        setupKeyboardShortcuts();
        
        // Check for URL hash to open a specific note
        if (window.location.hash) {
            const noteId = window.location.hash.substring(1);
            const note = notes.find(n => n.id === noteId);
            if (note) {
                editNote(noteId);
            }
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        // Button events
        addNoteBtn.addEventListener('click', openNewNote);
        saveNoteBtn.addEventListener('click', saveNote);
        cancelEditBtn.addEventListener('click', cancelEdit);
        pinNoteBtn.addEventListener('click', togglePinNote);
        previewToggle.addEventListener('click', togglePreview);
        alertOkBtn.addEventListener('click', () => customAlert.style.display = 'none');
        
        // Search and filter
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        filterCategory.addEventListener('change', () => renderNotes());
        
        // Rich text editor
        editorToolbar.addEventListener('click', handleFormatButtonClick);
        
        // Auto-save
        noteContent.addEventListener('input', handleContentChange);
        noteTitle.addEventListener('input', handleContentChange);
        noteTags.addEventListener('input', handleContentChange);
        
        // Handle paste events to clean up pasted content
        noteContent.addEventListener('paste', handlePaste);
    }

    // Set up right-click protection
    function setupRightClickProtection() {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            customAlert.style.display = 'flex';
        });
    }

    // Render all notes in the grid
    function renderNotes(searchTerm = '', filter = 'all') {
        let filteredNotes = [...notes];
        
        // Apply search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filteredNotes = filteredNotes.filter(note => 
                (note.title && note.title.toLowerCase().includes(searchLower)) ||
                (note.content && note.content.toLowerCase().includes(searchLower)) ||
                (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
        }
        
        // Apply category filter
        if (filter === 'pinned') {
            filteredNotes = filteredNotes.filter(note => note.pinned);
        } else if (filter === 'recent') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filteredNotes = filteredNotes.filter(note => new Date(note.updatedAt) > oneWeekAgo);
        }
        
        // Sort notes: pinned first, then by last updated
        filteredNotes.sort((a, b) => {
            if (a.pinned !== b.pinned) {
                return a.pinned ? -1 : 1;
            }
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        if (filteredNotes.length === 0) {
            notesGrid.innerHTML = `
                <div class="no-notes">
                    <i class="fas fa-sticky-note"></i>
                    <p>${searchTerm ? 'No matching notes found.' : 'No notes yet. Click "New Note" to get started!'}</p>
                </div>`;
            return;
        }

        notesGrid.innerHTML = filteredNotes.map(note => `
            <div class="note-card ${note.pinned ? 'pinned' : ''}" data-id="${note.id}">
                ${note.pinned ? '<div class="pin-indicator"><i class="fas fa-thumbtack"></i></div>' : ''}
                <h3>${note.title ? note.title.replace(/<[^>]*>?/gm, '').substring(0, 50) : 'Untitled Note'}</h3>
                <div class="note-content-preview">
                    ${note.content ? 
                        note.content.replace(/<[^>]*>?/gm, '').substring(0, 150) + 
                        (note.content.length > 150 ? '...' : '') : 
                        '<span class="no-content">No content</span>'}
                </div>
                ${note.tags && note.tags.length > 0 ? `
                    <div class="note-tags">
                        ${note.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                        ${note.tags.length > 3 ? `<span class="tag-more">+${note.tags.length - 3}</span>` : ''}
                    </div>` : ''}
                <div class="note-footer">
                    <div class="note-date">${formatDate(note.updatedAt)}</div>
                    <div class="note-actions">
                        <button class="btn-icon pin-note" title="${note.pinned ? 'Unpin' : 'Pin'}">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button class="btn-icon edit-note" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-note" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners to note actions
        document.querySelectorAll('.edit-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.closest('.note-card').dataset.id;
                editNote(noteId);
            });
        });

        document.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.closest('.note-card').dataset.id;
                deleteNote(noteId);
            });
        });

        document.querySelectorAll('.pin-note').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const noteId = btn.closest('.note-card').dataset.id;
                const noteIndex = notes.findIndex(n => n.id === noteId);
                if (noteIndex !== -1) {
                    notes[noteIndex].pinned = !notes[noteIndex].pinned;
                    notes[noteIndex].updatedAt = new Date().toISOString();
                    await saveNotes();
                    renderNotes(searchInput.value, filterCategory.value);
                }
            });
        });

        // Add click event to open note for editing
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on buttons or links
                if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A') {
                    return;
                }
                const noteId = card.dataset.id;
                editNote(noteId);
            });
        });
    }

    // Open the editor for a new note
    function openNewNote() {
        currentNoteId = null;
        isEditing = false;
        noteTitle.innerHTML = '';
        noteContent.innerHTML = '';
        noteTags.value = '';
        pinNoteBtn.innerHTML = '<i class="far fa-thumbtack"></i>';
        noteEditor.style.display = 'block';
        noteTitle.focus();
        
        // Update URL without page refresh
        history.pushState(null, '', '#');
        
        // Scroll to editor
        noteEditor.scrollIntoView({ behavior: 'smooth' });
        
        // Update preview
        updatePreview();
    }

    // Open the editor to edit an existing note
    function editNote(noteId) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        currentNoteId = noteId;
        isEditing = true;
        noteTitle.innerHTML = note.title || '';
        noteContent.innerHTML = note.content || '';
        noteTags.value = note.tags ? note.tags.join(', ') : '';
        
        // Update pin button state
        pinNoteBtn.innerHTML = note.pinned ? 
            '<i class="fas fa-thumbtack"></i>' : 
            '<i class="far fa-thumbtack"></i>';
            
        noteEditor.style.display = 'block';
        
        // Update URL with note ID for deep linking
        history.pushState(null, '', `#${noteId}`);
        
        // Scroll to editor
        noteEditor.scrollIntoView({ behavior: 'smooth' });
        
        // Update preview
        updatePreview();
    }

    // Save a new or existing note
    async function saveNote() {
        const title = noteTitle.innerHTML.trim();
        const content = noteContent.innerHTML.trim();
        const tags = noteTags.value.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
            
        const now = new Date();
        const isPinned = pinNoteBtn.innerHTML.includes('fa-thumbtack');

        if (!title && !content) {
            alert('Please add a title or content to your note.');
            return;
        }

        const noteData = {
            id: currentNoteId || Date.now().toString(),
            title,
            content,
            tags,
            pinned: isPinned,
            updatedAt: now.toISOString(),
            createdAt: isEditing 
                ? notes.find(n => n.id === currentNoteId)?.createdAt || now.toISOString()
                : now.toISOString()
        };

        if (isEditing) {
            // Update existing note
            const noteIndex = notes.findIndex(n => n.id === currentNoteId);
            if (noteIndex !== -1) {
                notes[noteIndex] = noteData;
            }
        } else {
            // Add new note
            notes.unshift(noteData);
        }


        // Save to localStorage
        await saveNotes();
        
        // Reset and re-render
        cancelEdit();
        renderNotes(searchInput.value, filterCategory.value);
    }
    
    // Save notes to localStorage with error handling
    async function saveNotes() {
        try {
            localStorage.setItem('hiddenDevNotes', JSON.stringify(notes));
            return true;
        } catch (error) {
            console.error('Error saving notes:', error);
            alert('Error saving notes. Your browser may be out of storage space.');
            return false;
        }
    }

    // Delete a note
    function deleteNote(noteId) {
        if (confirm('Are you sure you want to delete this note? This cannot be undone.')) {
            notes = notes.filter(note => note.id !== noteId);
            localStorage.setItem('hiddenDevNotes', JSON.stringify(notes));
            
            // If we're currently editing the deleted note, close the editor
            if (currentNoteId === noteId) {
                cancelEdit();
            }
            
            renderNotes();
        }
    }

    // Cancel editing and close the editor
    function cancelEdit() {
        // Clear any pending auto-save
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
        }
        
        noteEditor.style.display = 'none';
        currentNoteId = null;
        isEditing = false;
        
        // Clear the URL hash
        if (window.location.hash) {
            history.pushState('', document.title, window.location.pathname + window.location.search);
        }
    }

    // Format date for display
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) {
            return 'Today at ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (diffInDays === 1) {
            return 'Yesterday at ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (diffInDays < 7) {
            return `${diffInDays} days ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric'
            });
        }
    }
    
    // Toggle note pin status
    function togglePinNote() {
        pinNoteBtn.innerHTML = pinNoteBtn.innerHTML.includes('fa-thumbtack') ? 
            '<i class="far fa-thumbtack"></i>' : 
            '<i class="fas fa-thumbtack"></i>';
    }
    
    // Toggle preview mode
    function togglePreview() {
        isPreviewMode = !isPreviewMode;
        previewToggle.innerHTML = isPreviewMode ? 
            '<i class="fas fa-edit"></i> Edit' : 
            '<i class="fas fa-eye"></i> Preview';
            
        document.querySelector('.editor-content').style.display = isPreviewMode ? 'none' : 'block';
        notePreview.style.display = isPreviewMode ? 'block' : 'none';
        
        if (isPreviewMode) {
            updatePreview();
        }
    }
    
    // Update the preview panel
    function updatePreview() {
        notePreview.innerHTML = `
            <h1>${noteTitle.innerHTML || 'Untitled Note'}</h1>
            <div class="note-content">${noteContent.innerHTML || '<p>No content</p>'}</div>
        `;
        
        // Apply syntax highlighting to code blocks
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
    
    // Handle search input
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        renderNotes(searchTerm, filterCategory.value);
    }
    
    // Handle format button clicks
    function handleFormatButtonClick(e) {
        const button = e.target.closest('button[data-command]');
        if (!button) return;
        
        e.preventDefault();
        const command = button.getAttribute('data-command');
        
        if (command === 'createLink') {
            const url = prompt('Enter URL:');
            if (url) {
                document.execCommand(command, false, url);
            }
        } else {
            document.execCommand(command, false, null);
        }
        
        // Return focus to content
        noteContent.focus();
    }
    
    // Handle content changes for auto-save
    function handleContentChange() {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        
        autoSaveTimer = setTimeout(() => {
            if (isEditing) {
                saveNote();
            }
        }, AUTO_SAVE_DELAY);
        
        if (isPreviewMode) {
            updatePreview();
        }
    }
    
    // Clean up pasted content
    function handlePaste(e) {
        e.preventDefault();
        
        // Get pasted text
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        
        // Clean and insert the text
        const cleanText = text
            .replace(/<[^>]*>?/gm, '') // Remove HTML tags
            .replace(/\n/g, '<br>');   // Preserve line breaks
            
        document.execCommand('insertHTML', false, cleanText);
    }
    
    // Set up keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in an input or contenteditable
            if (e.target.tagName === 'INPUT' || e.target.isContentEditable) {
                return;
            }
            
            // Ctrl+N: New note
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                openNewNote();
            }
            // Ctrl+S: Save note
            else if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (isEditing) {
                    saveNote();
                }
            }
            // Esc: Close editor
            else if (e.key === 'Escape' && noteEditor.style.display === 'block') {
                cancelEdit();
            }
        });
        
        // Editor shortcuts
        noteContent.addEventListener('keydown', (e) => {
            // Ctrl+B: Bold
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold', false, null);
            }
            // Ctrl+I: Italic
            else if (e.ctrlKey && e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic', false, null);
            }
            // Ctrl+K: Insert link
            else if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                const url = prompt('Enter URL:');
                if (url) {
                    document.execCommand('createLink', false, url);
                }
            }
            // Ctrl+P: Toggle preview
            else if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                togglePreview();
            }
        });
    }
    
    // Debounce function to limit how often a function is called
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    // Initialize the app
    init();
});