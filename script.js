document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const notesGrid = document.getElementById('notes-grid');
    const noteEditor = document.getElementById('note-editor');
    const noteTitle = document.getElementById('note-title');
    const noteContent = document.getElementById('note-content');
    const addNoteBtn = document.getElementById('add-note-btn');
    const saveNoteBtn = document.getElementById('save-note');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const customAlert = document.getElementById('custom-alert');
    const alertOkBtn = document.getElementById('alert-ok-btn');

    // State
    let notes = JSON.parse(localStorage.getItem('hiddenDevNotes')) || [];
    let currentNoteId = null;
    let isEditing = false;

    // Initialize the app
    function init() {
        renderNotes();
        setupEventListeners();
        setupRightClickProtection();
    }

    // Set up event listeners
    function setupEventListeners() {
        addNoteBtn.addEventListener('click', openNewNote);
        saveNoteBtn.addEventListener('click', saveNote);
        cancelEditBtn.addEventListener('click', cancelEdit);
        alertOkBtn.addEventListener('click', () => customAlert.style.display = 'none');
    }

    // Set up right-click protection
    function setupRightClickProtection() {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            customAlert.style.display = 'flex';
        });
    }

    // Render all notes in the grid
    function renderNotes() {
        if (notes.length === 0) {
            notesGrid.innerHTML = `
                <div class="no-notes">
                    <i class="fas fa-sticky-note"></i>
                    <p>No notes yet. Click 'New Note' to get started!</p>
                </div>`;
            return;
        }

        notesGrid.innerHTML = notes.map(note => `
            <div class="note-card" data-id="${note.id}">
                <h3>${note.title || 'Untitled Note'}</h3>
                <p>${note.content || 'No content'}</p>
                <div class="note-date">${formatDate(note.updatedAt)}</div>
                <div class="note-actions">
                    <button class="edit-note" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="delete-note" title="Delete"><i class="fas fa-trash"></i></button>
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

        // Add click event to open note for editing
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', () => {
                const noteId = card.dataset.id;
                editNote(noteId);
            });
        });
    }

    // Open the editor for a new note
    function openNewNote() {
        currentNoteId = null;
        isEditing = false;
        noteTitle.value = '';
        noteContent.value = '';
        noteEditor.style.display = 'block';
        noteTitle.focus();
        
        // Scroll to editor
        noteEditor.scrollIntoView({ behavior: 'smooth' });
    }

    // Open the editor to edit an existing note
    function editNote(noteId) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        currentNoteId = noteId;
        isEditing = true;
        noteTitle.value = note.title || '';
        noteContent.value = note.content || '';
        noteEditor.style.display = 'block';
        noteTitle.focus();
        
        // Scroll to editor
        noteEditor.scrollIntoView({ behavior: 'smooth' });
    }

    // Save a new or existing note
    function saveNote() {
        const title = noteTitle.value.trim();
        const content = noteContent.value.trim();
        const now = new Date();

        if (!title && !content) {
            alert('Please add a title or content to your note.');
            return;
        }

        const noteData = {
            id: currentNoteId || Date.now().toString(),
            title,
            content,
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
        localStorage.setItem('hiddenDevNotes', JSON.stringify(notes));
        
        // Reset and re-render
        cancelEdit();
        renderNotes();
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
        noteEditor.style.display = 'none';
        currentNoteId = null;
        isEditing = false;
    }

    // Format date for display
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Initialize the app
    init();
});