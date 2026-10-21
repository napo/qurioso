// Native menu labels. The menu follows the system language, then the language chosen in the app; English otherwise.
const MENU_TEXT = {
  it: {
    networkQuiz: 'Quiz in Rete', classroom: 'Attività in classe', quit: 'Esci da Qurioso',
    checkUpdates: 'Verifica aggiornamenti…', autoUpdates: 'Controlla aggiornamenti all’avvio',
    cancelUpdate: 'Annulla controllo o download aggiornamento', updateFolder: 'Apri cartella aggiornamenti scaricati',
    file: 'File', newQuiz: 'Nuovo quiz', newVideoQuiz: 'Nuovo quiz video', importQuestions: 'Importa domande…', backup: 'Backup e ripristino…',
    edit: 'Modifica', undo: 'Annulla', redo: 'Ripeti', cut: 'Taglia', copy: 'Copia', paste: 'Incolla', selectAll: 'Seleziona tutto',
    view: 'Visualizza', reload: 'Ricarica', forceReload: 'Ricarica forzata', toggleDevTools: 'Strumenti per sviluppatori',
    resetZoom: 'Dimensioni reali', zoomIn: 'Ingrandisci', zoomOut: 'Riduci', toggleFullscreen: 'Schermo intero',
    help: 'Aiuto', guide: 'Guida', about: 'Informazioni su Qurioso',
  },
  en: {
    networkQuiz: 'Network quizzes', classroom: 'Classroom activities', quit: 'Quit Qurioso',
    checkUpdates: 'Check for updates…', autoUpdates: 'Check for updates at startup',
    cancelUpdate: 'Cancel update check or download', updateFolder: 'Open downloaded updates folder',
    file: 'File', newQuiz: 'New quiz', newVideoQuiz: 'New video quiz', importQuestions: 'Import questions…', backup: 'Backup and restore…',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select all',
    view: 'View', reload: 'Reload', forceReload: 'Force reload', toggleDevTools: 'Developer tools',
    resetZoom: 'Actual size', zoomIn: 'Zoom in', zoomOut: 'Zoom out', toggleFullscreen: 'Full screen',
    help: 'Help', guide: 'Guide', about: 'About Qurioso',
  },
  de: {
    networkQuiz: 'Netzwerkquiz', classroom: 'Aktivitäten im Unterricht', quit: 'Qurioso beenden',
    checkUpdates: 'Nach Updates suchen…', autoUpdates: 'Beim Start nach Updates suchen',
    cancelUpdate: 'Updateprüfung oder Download abbrechen', updateFolder: 'Ordner mit heruntergeladenen Updates öffnen',
    file: 'Datei', newQuiz: 'Neues Quiz', newVideoQuiz: 'Neues Videoquiz', importQuestions: 'Fragen importieren…', backup: 'Sicherung und Wiederherstellung…',
    edit: 'Bearbeiten', undo: 'Rückgängig', redo: 'Wiederholen', cut: 'Ausschneiden', copy: 'Kopieren', paste: 'Einfügen', selectAll: 'Alles auswählen',
    view: 'Ansicht', reload: 'Neu laden', forceReload: 'Neu laden erzwingen', toggleDevTools: 'Entwicklerwerkzeuge',
    resetZoom: 'Originalgröße', zoomIn: 'Vergrößern', zoomOut: 'Verkleinern', toggleFullscreen: 'Vollbild',
    help: 'Hilfe', guide: 'Anleitung', about: 'Über Qurioso',
  },
};

/** Maps a locale such as "de-AT" or "it_IT" to a supported menu language; anything else uses English. */
function menuLanguage(locale) {
  const code = String(locale || '').slice(0, 2).toLowerCase();
  return Object.hasOwn(MENU_TEXT, code) ? code : 'en';
}

module.exports = { MENU_TEXT, menuLanguage };
