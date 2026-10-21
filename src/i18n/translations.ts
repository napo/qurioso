export type Language = 'it' | 'en' | 'de';

export interface Translations {
  appName: string;
  appTagline: string;
  appDescription: string;
  authorLabel: string;
  licenseLabel: string;
  
  // Header
  studioLiveBadge: string;
  joinWithPin: string;
  createQuiz: string;
  buildAndGitHub: string;
  muteAudio: string;
  unmuteAudio: string;
  installApp: string;
  installOnIOS: string;

  // Hero & Dashboard
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  createNewQuizBtn: string;
  tryVideoQuizBtn: string;
  buildPlatformsBtn: string;
  libraryTitle: string;
  librarySubtitle: string;
  newQuizBtn: string;
  multiplayerLiveBadge: string;
  videoQuizBadge: string;
  questionsCount: string;
  startHostScreen: string;
  playVideoMode: string;
  editQuiz: string;
  duplicateQuiz: string;
  deleteQuiz: string;
  deleteQuizConfirm: string;
  cantDeleteLastQuiz: string;

  // Features Cards
  feat1Title: string;
  feat1Desc: string;
  feat2Title: string;
  feat2Desc: string;
  feat3Title: string;
  feat3Desc: string;

  // Host Screen
  gamePinLabel: string;
  quizLabel: string;
  fullscreen: string;
  exit: string;
  scanWithCamera: string;
  orOpenPlayerTab: string;
  connectedParticipants: string;
  addBotTest: string;
  waitingPlayers: string;
  scanOrAddBotsPrompt: string;
  startQuizBtn: string;
  readyCountdown: string;
  questionOf: string;
  showAnswersNow: string;
  answersReceived: string;
  questionResult: string;
  explanationTitle: string;
  showLeaderboard: string;
  partialLeaderboard: string;
  topPlayers: string;
  nextQuestion: string;
  viewFinalPodium: string;
  qrModalTitle: string;
  qrModalDesc: string;
  closeBtn: string;
  copyLink: string;
  copied: string;
  openPlayerWindow: string;

  // Player Screen
  joinQuizTitle: string;
  joinQuizSubtitle: string;
  gamePinInputLabel: string;
  nicknameInputLabel: string;
  chooseAvatarLabel: string;
  enterGameBtn: string;
  cancelAndReturn: string;
  youAreIn: string;
  waitForHost: string;
  connectedToPin: string;
  getReady: string;
  questionComing: string;
  watchMainScreen: string;
  answerSubmitted: string;
  waitingForOthers: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctBadge: string;
  wrongBadge: string;
  positionLabel: string;
  totalScoreLabel: string;
  leaderboardInProgress: string;
  watchScreenForRank: string;
  currentPosition: string;
  pointsAccumulated: string;

  // Video Quiz
  videoQuizMode: string;
  definedSequence: string;
  randomSequence: string;
  videoPausedAlert: string;
  clickToStartVideo: string;
  continueVideo: string;
  greatJobCorrect: string;
  tooBadWrong: string;
  restartVideoQuiz: string;
  configureVideo: string;
  presetVideos: string;
  orCustomUrl: string;
  loadUrlBtn: string;
  currentCheckpoints: string;
  plannedPauses: string;

  // Final Podium
  finalLeaderboardTitle: string;
  exportCsv: string;
  exportJson: string;
  championBadge: string;
  completeAnswersTable: string;
  participantsCount: string;
  posCol: string;
  playerCol: string;
  pointsCol: string;
  correctCol: string;
  accuracyCol: string;
  avgTimeCol: string;
  playAgain: string;
  backToDashboard: string;

  // Multiplatform Guide
  guideTitle: string;
  guideSubtitle: string;
  tabOverview: string;
  tabAndroid: string;
  tabDesktop: string;
  tabGitHub: string;
  readyForGitHub: string;
  initGitTitle: string;
  mobileCardTitle: string;
  mobileCardDesc: string;
  desktopCardTitle: string;
  desktopCardDesc: string;
  androidGuideTitle: string;
  androidGuideDesc: string;
  twaHint: string;
  desktopGuideTitle: string;
  desktopGuideDesc: string;
  githubActionsTitle: string;
  githubActionsDesc: string;
  understandBtn: string;

  // Quiz Editor
  untitledQuiz: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  categoryHint: string;
  questionsCreated: string;
  importJson: string;
  exportJsonFile: string;
  saveQuiz: string;
  questionsSidebarTitle: string;
  multipleChoice: string;
  trueFalse: string;
  noQuestionText: string;
  moveUp: string;
  moveDown: string;
  duplicate: string;
  delete: string;
  addMultipleChoice: string;
  addTrueFalse: string;
  questionTextInputLabel: string;
  optionalMediaUrl: string;
  removeMedia: string;
  responseOptionsLabel: string;
  correctCount: string;
  explanationCuriosityLabel: string;
  questionSettings: string;
  timeLimitLabel: string;
  standardPointsLabel: string;
  videoCheckpointLabel: string;
  videoCheckpointHint: string;
}

export const translations: Record<Language, Translations> = {
  it: {
    appName: 'Qurioso',
    appTagline: 'Quiz Multigiocatore Interattivi e Quiz Video con Pause',
    appDescription: 'Piattaforma interattiva di quiz multiplayer con codice QR, modalità video a pause automatiche e classifiche in tempo reale.',
    authorLabel: 'Autore: Maurizio Napolitano <maurizio.napolitano@gmail.com>',
    licenseLabel: 'Rilasciato sotto licenza GNU Affero General Public License v3 (AGPL-3.0)',

    studioLiveBadge: 'Editor e Diretta',
    joinWithPin: 'Partecipa con PIN',
    createQuiz: 'Crea Quiz',
    buildAndGitHub: 'Compilazione e GitHub',
    muteAudio: 'Disattiva Audio',
    unmuteAudio: 'Riattiva Audio',
    installApp: 'Installa App',
    installOnIOS: 'Installa su iOS',

    heroBadge: 'Editor di Quiz e Piattaforma Multigiocatore in Diretta',
    heroTitle: 'Crea, Condividi & Sfida in Tempo Reale',
    heroDescription: 'Costruisci quiz interattivi dinamici. Genera il QR Code per consentire ai partecipanti di rispondere istantaneamente dal proprio dispositivo, sfrutta la Modalità Quiz Video con pause automatiche e consulta le classifiche dettagliate!',
    createNewQuizBtn: 'Crea Nuovo Quiz',
    tryVideoQuizBtn: 'Prova Quiz Video',
    buildPlatformsBtn: 'Compila per Linux / Win / Mac / Android',
    libraryTitle: 'Libreria Quiz Disponibili',
    librarySubtitle: 'Seleziona un quiz per proiettarlo ai partecipanti o avviare la modalità video',
    newQuizBtn: 'Nuovo',
    multiplayerLiveBadge: 'Multigiocatore in Diretta',
    videoQuizBadge: 'Quiz Video',
    questionsCount: 'domande',
    startHostScreen: 'Avvia Schermo Presentatore (QR & Lobby)',
    playVideoMode: 'Esegui Modalità Video con Pause',
    editQuiz: 'Modifica',
    duplicateQuiz: 'Duplica',
    deleteQuiz: 'Elimina',
    deleteQuizConfirm: 'Sei sicuro di voler eliminare questo quiz?',
    cantDeleteLastQuiz: 'Non puoi eliminare l\'ultimo quiz presente.',

    feat1Title: 'QR Code & PIN Istantaneo',
    feat1Desc: 'I partecipanti inquadrano il QR Code con la fotocamera per accedere subito con soprannome e avatar personalizzato.',
    feat2Title: 'Quiz Video con Pause',
    feat2Desc: 'Il video si ferma a intervalli impostati dall\'autore o casuali, proponendo un quiz prima di riprendere la riproduzione.',
    feat3Title: 'Classifiche & Export CSV',
    feat3Desc: 'Podio a 3 posizioni, animazioni di punti e streak, e download completo dei risultati in CSV o JSON.',

    gamePinLabel: 'PIN GIOCO:',
    quizLabel: 'Quiz:',
    fullscreen: 'Schermo Intero',
    exit: 'Esci',
    scanWithCamera: 'Inquadra con la Fotocamera',
    orOpenPlayerTab: 'Oppure unisciti aprendo la scheda giocatore',
    connectedParticipants: 'Partecipanti Connessi',
    addBotTest: '+3 Bot di Prova',
    waitingPlayers: 'In attesa dei giocatori...',
    scanOrAddBotsPrompt: 'Scansiona il QR code o clicca "+3 Bot di Prova" per provare subito!',
    startQuizBtn: 'AVVIA IL QUIZ',
    readyCountdown: 'Preparati! Domanda in arrivo',
    questionOf: 'Domanda',
    showAnswersNow: 'Mostra Risposte Ora',
    answersReceived: 'Risposte',
    questionResult: 'Esito Domanda',
    explanationTitle: 'Spiegazione & Curiosità:',
    showLeaderboard: 'Visualizza Classifica',
    partialLeaderboard: 'Classifica Parziale',
    topPlayers: 'Migliori Giocatori',
    nextQuestion: 'Prossima Domanda',
    viewFinalPodium: 'Vedi Podio Finale',
    qrModalTitle: 'QR Code per Partecipare',
    qrModalDesc: 'Fai inquadrare questo codice ai partecipanti per entrare istantaneamente nel quiz.',
    closeBtn: 'Chiudi',
    copyLink: 'Copia Link',
    copied: 'Copiato!',
    openPlayerWindow: 'Apri finestra giocatore',

    joinQuizTitle: 'Partecipa al Quiz',
    joinQuizSubtitle: 'Inserisci il PIN del gioco mostrato sullo schermo',
    gamePinInputLabel: 'PIN di Gioco',
    nicknameInputLabel: 'Il tuo Soprannome',
    chooseAvatarLabel: 'Scegli il tuo Avatar',
    enterGameBtn: 'ENTRA IN PARTITA',
    cancelAndReturn: 'Annulla e Torna alla Home',
    youAreIn: 'Sei dentro',
    waitForHost: 'Vedi il tuo nome sullo schermo principale? Attendi che il presentatore avvii il quiz.',
    connectedToPin: 'Connesso alla stanza PIN',
    getReady: 'Preparati!',
    questionComing: 'Domanda in arrivo...',
    watchMainScreen: 'Guarda la domanda sullo schermo principale e rispondi rapidamente!',
    answerSubmitted: 'Risposta Inviata!',
    waitingForOthers: 'Hai risposto con successo. In attesa degli altri partecipanti e dello scadere del tempo...',
    optionA: 'Opzione A',
    optionB: 'Opzione B',
    optionC: 'Opzione C',
    optionD: 'Opzione D',
    correctBadge: 'CORRETTO!',
    wrongBadge: 'SBAGLIATO!',
    positionLabel: 'Posizione',
    totalScoreLabel: 'Punteggio Totale',
    leaderboardInProgress: 'Classifica in corso',
    watchScreenForRank: 'Guarda lo Schermo Principale!',
    currentPosition: 'La tua posizione attuale:',
    pointsAccumulated: 'punti accumulati',

    videoQuizMode: 'Modalità Quiz Video',
    definedSequence: 'Sequenza Definita',
    randomSequence: 'Sequenza Casuale',
    videoPausedAlert: 'Video in Pausa • Rispondi al Quesito!',
    clickToStartVideo: 'Clicca per avviare il video quiz',
    continueVideo: 'Continua Video',
    greatJobCorrect: 'Ottimo lavoro! Risposta corretta',
    tooBadWrong: 'Peccato! Risposta non corretta',
    restartVideoQuiz: 'Ricomincia Video e Quiz',
    configureVideo: 'Configura Video',
    presetVideos: 'Video Preimpostati:',
    orCustomUrl: 'Oppure inserisci URL video diretto (MP4):',
    loadUrlBtn: 'Carica',
    currentCheckpoints: 'Checkpoint Attuali:',
    plannedPauses: 'pause previste',

    finalLeaderboardTitle: 'Classifica Finale & Podio',
    exportCsv: 'CSV',
    exportJson: 'JSON',
    championBadge: '🏆 Campione Qurioso',
    completeAnswersTable: 'Tabella Completa delle Risposte & Classifica',
    participantsCount: 'partecipanti',
    posCol: 'Pos',
    playerCol: 'Giocatore',
    pointsCol: 'Punti',
    correctCol: 'Esatte',
    accuracyCol: 'Precisione',
    avgTimeCol: 'Tempo Med',
    playAgain: 'Gioca Ancora',
    backToDashboard: 'Torna alla Schermata Principale',

    guideTitle: 'Guida alla Compilazione Multipiattaforma e GitHub',
    guideSubtitle: 'Linux, Windows, Apple (macOS & iOS) e Android',
    tabOverview: 'Panoramica e GitHub',
    tabAndroid: 'Android (APK & AAB)',
    tabDesktop: 'Linux & Windows (.exe/.AppImage)',
    tabGitHub: 'Workflow di GitHub Actions',
    readyForGitHub: 'Architettura Pronta per il Deposito su GitHub:',
    initGitTitle: '1. Inizializzare e Caricare su GitHub',
    mobileCardTitle: 'Dispositivi Mobili (Android e iOS)',
    mobileCardDesc: 'Capacitor consente di generare l\'APK/AAB per il Google Play Store e il progetto Xcode per iPhone/iPad.',
    desktopCardTitle: 'Desktop (Linux, Windows, Mac)',
    desktopCardDesc: 'Compatibile al 100% con Electron per produrre installer .exe, pacchetti .deb o .AppImage e .dmg.',
    androidGuideTitle: 'Configurazione e Compilazione Android (Capacitor)',
    androidGuideDesc: 'Il file capacitor.config.json è già predisposto nel repository. Esegui questi comandi con Android Studio:',
    twaHint: 'Alternativa PWA TWA: Puoi anche usare Bubblewrap CLI di Google per generare l\'app Android senza codice nativo.',
    desktopGuideTitle: 'Compilazione Desktop con Electron (Linux, Windows, macOS)',
    desktopGuideDesc: 'Puoi aggiungere Electron in pochi secondi per produrre pacchetti eseguibili nativi:',
    githubActionsTitle: 'GitHub Actions: Compilazione e Rilascio Automatici',
    githubActionsDesc: 'Il file .github/workflows/build-multiplatform.yml compila automaticamente i binari per tutti i sistemi ad ogni release.',
    understandBtn: 'Ho Capito',

    untitledQuiz: 'Nuovo Quiz Senza Titolo',
    categoryLabel: 'Categoria',
    categoryPlaceholder: 'Es. Storia, Scienze, Geografia',
    categoryHint: 'Scegli una categoria esistente o scrivi un nuovo nome. La categoria viene salvata con il quiz.',
    questionsCreated: 'domande create',
    importJson: 'Importa JSON',
    exportJsonFile: 'Esporta',
    saveQuiz: 'Salva Quiz',
    questionsSidebarTitle: 'Domande',
    multipleChoice: 'Scelta Multipla',
    trueFalse: 'Vero/Falso',
    noQuestionText: 'Domanda senza testo',
    moveUp: 'Sposta Su',
    moveDown: 'Sposta Giù',
    duplicate: 'Duplica',
    delete: 'Elimina',
    addMultipleChoice: 'Scelta Multipla (4 opz.)',
    addTrueFalse: 'Vero / Falso',
    questionTextInputLabel: 'Testo della Domanda',
    optionalMediaUrl: 'Immagine o Media Opzionale (URL)',
    removeMedia: 'Rimuovi',
    responseOptionsLabel: 'Opzioni di Risposta (spunta la risposta esatta)',
    correctCount: 'corretta/e',
    explanationCuriosityLabel: 'Spiegazione / Curiosità (mostrata dopo la risposta)',
    questionSettings: 'Parametri Domanda',
    timeLimitLabel: 'Tempo Limite',
    standardPointsLabel: 'Punti Standard',
    videoCheckpointLabel: 'Momento del Quiz Video (secondi)',
    videoCheckpointHint: 'A quale secondo del video deve apparire questa domanda?',
  },
  en: {
    appName: 'Qurioso',
    appTagline: 'Interactive Multiplayer Quizzes & Video Quizzes with Pauses',
    appDescription: 'Interactive multiplayer quiz platform with QR code, automatic video pause checkpoints, and real-time leaderboards.',
    authorLabel: 'Author: Maurizio Napolitano <maurizio.napolitano@gmail.com>',
    licenseLabel: 'Released under GNU Affero General Public License v3 (AGPL-3.0)',

    studioLiveBadge: 'Studio & Live',
    joinWithPin: 'Join with PIN',
    createQuiz: 'Create Quiz',
    buildAndGitHub: 'Build & GitHub',
    muteAudio: 'Mute Audio',
    unmuteAudio: 'Unmute Audio',
    installApp: 'Install App',
    installOnIOS: 'Install on iOS',

    heroBadge: 'Quiz Studio & Live Multiplayer Platform',
    heroTitle: 'Create, Share & Compete in Real-Time',
    heroDescription: 'Build fast-paced interactive quizzes. Generate a QR Code for instant smartphone participation, experience Video Quiz mode with automatic pause checkpoints, and track detailed live leaderboards!',
    createNewQuizBtn: 'Create New Quiz',
    tryVideoQuizBtn: 'Try Video Quiz',
    buildPlatformsBtn: 'Build Linux / Win / Mac / Android',
    libraryTitle: 'Available Quizzes Library',
    librarySubtitle: 'Select a quiz to present live to participants or launch video quiz mode',
    newQuizBtn: 'New',
    multiplayerLiveBadge: 'Live Multiplayer',
    videoQuizBadge: 'Video Quiz',
    questionsCount: 'questions',
    startHostScreen: 'Launch Presenter Screen (QR & Lobby)',
    playVideoMode: 'Run Video Mode with Pauses',
    editQuiz: 'Edit',
    duplicateQuiz: 'Duplicate',
    deleteQuiz: 'Delete',
    deleteQuizConfirm: 'Are you sure you want to delete this quiz?',
    cantDeleteLastQuiz: 'You cannot delete the only remaining quiz.',

    feat1Title: 'Instant QR Code & PIN',
    feat1Desc: 'Participants scan the QR Code with their camera to join instantly with their nickname and custom avatar.',
    feat2Title: 'Video Quiz with Pauses',
    feat2Desc: 'The video pauses automatically at custom or random checkpoints to present questions before resuming.',
    feat3Title: 'Leaderboards & CSV Export',
    feat3Desc: '3-tier animated podium, point increments, streak flames, and complete CSV or JSON report export.',

    gamePinLabel: 'GAME PIN:',
    quizLabel: 'Quiz:',
    fullscreen: 'Fullscreen',
    exit: 'Exit',
    scanWithCamera: 'Scan with Camera',
    orOpenPlayerTab: 'Or join by opening player tab',
    connectedParticipants: 'Connected Participants',
    addBotTest: '+3 Test Bots',
    waitingPlayers: 'Waiting for players...',
    scanOrAddBotsPrompt: 'Scan the QR code or click "+3 Test Bots" to try right away!',
    startQuizBtn: 'START THE QUIZ',
    readyCountdown: 'Get ready! Question incoming',
    questionOf: 'Question',
    showAnswersNow: 'Show Answers Now',
    answersReceived: 'Answers',
    questionResult: 'Question Result',
    explanationTitle: 'Explanation & Fun Fact:',
    showLeaderboard: 'Show Leaderboard',
    partialLeaderboard: 'Current Leaderboard',
    topPlayers: 'Top Players',
    nextQuestion: 'Next Question',
    viewFinalPodium: 'View Final Podium',
    qrModalTitle: 'QR Code to Join',
    qrModalDesc: 'Have participants scan this code to enter the quiz instantly.',
    closeBtn: 'Close',
    copyLink: 'Copy Link',
    copied: 'Copied!',
    openPlayerWindow: 'Open player window',

    joinQuizTitle: 'Join the Quiz',
    joinQuizSubtitle: 'Enter the Game PIN displayed on the presenter screen',
    gamePinInputLabel: 'Game PIN',
    nicknameInputLabel: 'Your Nickname',
    chooseAvatarLabel: 'Choose Your Avatar',
    enterGameBtn: 'JOIN GAME',
    cancelAndReturn: 'Cancel & Return Home',
    youAreIn: 'You are in',
    waitForHost: 'See your name on the main screen? Wait for the host to start the quiz.',
    connectedToPin: 'Connected to room PIN',
    getReady: 'Get Ready!',
    questionComing: 'Question incoming...',
    watchMainScreen: 'Look at the question on the main screen and answer quickly!',
    answerSubmitted: 'Answer Submitted!',
    waitingForOthers: 'Answer locked in! Waiting for other participants and time to expire...',
    optionA: 'Option A',
    optionB: 'Option B',
    optionC: 'Option C',
    optionD: 'Option D',
    correctBadge: 'CORRECT!',
    wrongBadge: 'WRONG!',
    positionLabel: 'Position',
    totalScoreLabel: 'Total Score',
    leaderboardInProgress: 'Leaderboard in progress',
    watchScreenForRank: 'Look at the Main Screen!',
    currentPosition: 'Your current position:',
    pointsAccumulated: 'points scored',

    videoQuizMode: 'Video Quiz Mode',
    definedSequence: 'Defined Sequence',
    randomSequence: 'Random Sequence',
    videoPausedAlert: 'Video Paused • Answer the Question!',
    clickToStartVideo: 'Click to start video quiz',
    continueVideo: 'Continue Video',
    greatJobCorrect: 'Great job! Correct answer',
    tooBadWrong: 'Too bad! Incorrect answer',
    restartVideoQuiz: 'Restart Video & Quiz',
    configureVideo: 'Configure Video',
    presetVideos: 'Preset Videos:',
    orCustomUrl: 'Or enter direct video URL (MP4):',
    loadUrlBtn: 'Load',
    currentCheckpoints: 'Current Checkpoints:',
    plannedPauses: 'planned pauses',

    finalLeaderboardTitle: 'Final Leaderboard & Podium',
    exportCsv: 'CSV',
    exportJson: 'JSON',
    championBadge: '🏆 Qurioso Champion',
    completeAnswersTable: 'Complete Response Table & Ranking',
    participantsCount: 'participants',
    posCol: 'Rank',
    playerCol: 'Player',
    pointsCol: 'Points',
    correctCol: 'Correct',
    accuracyCol: 'Accuracy',
    avgTimeCol: 'Avg Time',
    playAgain: 'Play Again',
    backToDashboard: 'Back to Dashboard',

    guideTitle: 'Multi-Platform Build & GitHub Guide',
    guideSubtitle: 'Linux, Windows, Apple (macOS & iOS), and Android',
    tabOverview: 'Overview & GitHub',
    tabAndroid: 'Android (APK & AAB)',
    tabDesktop: 'Linux & Windows (.exe/.AppImage)',
    tabGitHub: 'GitHub Actions Workflow',
    readyForGitHub: 'Repository Architecture Ready for GitHub:',
    initGitTitle: '1. Initialize and Push to GitHub',
    mobileCardTitle: 'Mobile (Android & iOS)',
    mobileCardDesc: 'Capacitor generates APK/AAB for Google Play Store and Xcode project for iPhone/iPad.',
    desktopCardTitle: 'Desktop (Linux, Windows, Mac)',
    desktopCardDesc: '100% compatible with Electron to produce .exe installers, .deb or .AppImage, and .dmg files.',
    androidGuideTitle: 'Android Setup & Build (Capacitor)',
    androidGuideDesc: 'The capacitor.config.json is already prepared. Run these commands with Android Studio:',
    twaHint: 'PWA TWA Alternative: You can also use Google\'s Bubblewrap CLI to produce an Android app without native code.',
    desktopGuideTitle: 'Desktop Packaging with Electron (Linux, Windows, macOS)',
    desktopGuideDesc: 'You can add Electron in seconds to generate native executable packages:',
    githubActionsTitle: 'GitHub Actions: Automated CI/CD Builds',
    githubActionsDesc: 'The .github/workflows/build-multiplatform.yml file automatically compiles binaries on every release push.',
    understandBtn: 'Got It',

    untitledQuiz: 'Untitled New Quiz',
    categoryLabel: 'Category',
    categoryPlaceholder: 'E.g. History, Science, Geography',
    categoryHint: 'Choose an existing category or enter a new name. The category is saved with the quiz.',
    questionsCreated: 'questions created',
    importJson: 'Import JSON',
    exportJsonFile: 'Export',
    saveQuiz: 'Save Quiz',
    questionsSidebarTitle: 'Questions',
    multipleChoice: 'Multiple Choice',
    trueFalse: 'True/False',
    noQuestionText: 'Question without text',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    duplicate: 'Duplicate',
    delete: 'Delete',
    addMultipleChoice: 'Multiple Choice (4 options)',
    addTrueFalse: 'True / False',
    questionTextInputLabel: 'Question Text',
    optionalMediaUrl: 'Optional Image or Media (URL)',
    removeMedia: 'Remove',
    responseOptionsLabel: 'Answer Options (check the correct answer)',
    correctCount: 'correct',
    explanationCuriosityLabel: 'Explanation / Curiosity (shown after answer reveal)',
    questionSettings: 'Question Parameters',
    timeLimitLabel: 'Time Limit',
    standardPointsLabel: 'Standard Points',
    videoCheckpointLabel: 'Video Quiz Checkpoint (seconds)',
    videoCheckpointHint: 'At what second of the video should this question appear?',
  },
  de: {
    appName: 'Qurioso',
    appTagline: 'Interaktive Multiplayer-Quizze & Video-Quizze mit Pausen',
    appDescription: 'Interaktive Plattform für Multiplayer-Quizze mit QR-Code, automatischen Video-Pausen und Echtzeit-Ranglisten.',
    authorLabel: 'Autor: Maurizio Napolitano <maurizio.napolitano@gmail.com>',
    licenseLabel: 'Veröffentlicht unter der GNU Affero General Public License v3 (AGPL-3.0)',

    studioLiveBadge: 'Editor & Live-Modus',
    joinWithPin: 'Mit PIN beitreten',
    createQuiz: 'Quiz erstellen',
    buildAndGitHub: 'Kompilierung & GitHub',
    muteAudio: 'Ton stumm',
    unmuteAudio: 'Ton an',
    installApp: 'App installieren',
    installOnIOS: 'Auf iOS installieren',

    heroBadge: 'Quiz-Editor & Live-Mehrspieler-Plattform',
    heroTitle: 'Erstellen, Teilen & in Echtzeit Messen',
    heroDescription: 'Erstelle dynamische interaktive Quizze. Generiere den QR-Code, damit Teilnehmer direkt mit ihrem Smartphone antworten können, nutze den Video-Quiz-Modus mit automatischen Pausen und verfolge detaillierte Ranglisten!',
    createNewQuizBtn: 'Neues Quiz erstellen',
    tryVideoQuizBtn: 'Video-Quiz testen',
    buildPlatformsBtn: 'Für Linux / Win / Mac / Android kompilieren',
    libraryTitle: 'Verfügbare Quiz-Bibliothek',
    librarySubtitle: 'Wähle ein Quiz aus, um es live zu präsentieren oder den Video-Modus zu starten',
    newQuizBtn: 'Neu',
    multiplayerLiveBadge: 'Live-Mehrspieler',
    videoQuizBadge: 'Video-Quiz',
    questionsCount: 'Fragen',
    startHostScreen: 'Präsentations-Bildschirm starten (QR & Lobby)',
    playVideoMode: 'Video-Modus mit Pausen ausführen',
    editQuiz: 'Bearbeiten',
    duplicateQuiz: 'Duplizieren',
    deleteQuiz: 'Löschen',
    deleteQuizConfirm: 'Möchtest du dieses Quiz wirklich löschen?',
    cantDeleteLastQuiz: 'Das letzte verbleibende Quiz kann nicht gelöscht werden.',

    feat1Title: 'Sofortiger QR-Code & PIN',
    feat1Desc: 'Teilnehmer scannen den QR-Code mit der Kamera, um direkt mit Spitzname und individuellem Avatar beizutreten.',
    feat2Title: 'Video-Quiz mit Pausen',
    feat2Desc: 'Das Video pausiert automatisch an benutzerdefinierten oder zufälligen Stellen für Quizfragen.',
    feat3Title: 'Ranglisten & CSV-Export',
    feat3Desc: '3-stufiges Podest, animierte Punkte und Serien-Boni sowie vollständiger CSV- oder JSON-Export.',

    gamePinLabel: 'SPIEL-PIN:',
    quizLabel: 'Quiz:',
    fullscreen: 'Vollbild',
    exit: 'Beenden',
    scanWithCamera: 'Mit Kamera scannen',
    orOpenPlayerTab: 'Oder als Spieler-Tab öffnen',
    connectedParticipants: 'Verbundene Teilnehmer',
    addBotTest: '+3 Test-Bots',
    waitingPlayers: 'Warte auf Spieler...',
    scanOrAddBotsPrompt: 'Scanne den QR-Code oder klicke auf "+3 Test-Bots", um sofort zu testen!',
    startQuizBtn: 'QUIZ STARTEN',
    readyCountdown: 'Bereit machen! Frage kommt',
    questionOf: 'Frage',
    showAnswersNow: 'Antworten jetzt anzeigen',
    answersReceived: 'Antworten',
    questionResult: 'Ergebnis der Frage',
    explanationTitle: 'Erklärung & Wissenswertes:',
    showLeaderboard: 'Rangliste anzeigen',
    partialLeaderboard: 'Aktuelle Rangliste',
    topPlayers: 'Beste Spieler',
    nextQuestion: 'Nächste Frage',
    viewFinalPodium: 'Finales Podest anzeigen',
    qrModalTitle: 'QR-Code zum Beitreten',
    qrModalDesc: 'Lass Teilnehmer diesen Code scannen, um dem Quiz beizutreten.',
    closeBtn: 'Schließen',
    copyLink: 'Link kopieren',
    copied: 'Kopiert!',
    openPlayerWindow: 'Spielerfenster öffnen',

    joinQuizTitle: 'Quiz beitreten',
    joinQuizSubtitle: 'Gib die auf dem Bildschirm angezeigte PIN ein',
    gamePinInputLabel: 'Spiel-PIN',
    nicknameInputLabel: 'Dein Spitzname',
    chooseAvatarLabel: 'Wähle deinen Avatar',
    enterGameBtn: 'SPIEL BEITRETEN',
    cancelAndReturn: 'Abbrechen & Zurück',
    youAreIn: 'Du bist dabei',
    waitForHost: 'Siehst du deinen Namen auf dem Hauptbildschirm? Warte auf den Spielleiter.',
    connectedToPin: 'Verbunden mit PIN',
    getReady: 'Bereit machen!',
    questionComing: 'Frage kommt...',
    watchMainScreen: 'Schau dir die Frage auf dem Hauptbildschirm an und antworte schnell!',
    answerSubmitted: 'Antwort gesendet!',
    waitingForOthers: 'Erfolgreich geantwortet. Warte auf die anderen Spieler...',
    optionA: 'Option A',
    optionB: 'Option B',
    optionC: 'Option C',
    optionD: 'Option D',
    correctBadge: 'RICHTIG!',
    wrongBadge: 'FALSCH!',
    positionLabel: 'Platzierung',
    totalScoreLabel: 'Gesamtpunktzahl',
    leaderboardInProgress: 'Rangliste läuft',
    watchScreenForRank: 'Schau auf den Hauptbildschirm!',
    currentPosition: 'Deine aktuelle Platzierung:',
    pointsAccumulated: 'gesammelte Punkte',

    videoQuizMode: 'Video-Quiz-Modus',
    definedSequence: 'Feste Reihenfolge',
    randomSequence: 'Zufällige Reihenfolge',
    videoPausedAlert: 'Video pausiert • Beantworte die Frage!',
    clickToStartVideo: 'Klicken, um das Video-Quiz zu starten',
    continueVideo: 'Video fortsetzen',
    greatJobCorrect: 'Großartig! Richtige Antwort',
    tooBadWrong: 'Schade! Leider falsche Antwort',
    restartVideoQuiz: 'Video & Quiz neu starten',
    configureVideo: 'Video konfigurieren',
    presetVideos: 'Vordefinierte Videos:',
    orCustomUrl: 'Oder direkte Video-URL (MP4) eingeben:',
    loadUrlBtn: 'Laden',
    currentCheckpoints: 'Aktuelle Kontrollpunkte:',
    plannedPauses: 'geplante Pausen',

    finalLeaderboardTitle: 'Endstand & Siegerehrung',
    exportCsv: 'CSV',
    exportJson: 'JSON',
    championBadge: '🏆 Qurioso-Sieger',
    completeAnswersTable: 'Vollständige Antworttabelle & Wertung',
    participantsCount: 'Teilnehmer',
    posCol: 'Rang',
    playerCol: 'Spieler',
    pointsCol: 'Punkte',
    correctCol: 'Richtig',
    accuracyCol: 'Genauigkeit',
    avgTimeCol: 'Durchschn. Zeit',
    playAgain: 'Nochmal spielen',
    backToDashboard: 'Zurück zur Übersicht',

    guideTitle: 'Anleitung: Multiplattform-Kompilierung & GitHub',
    guideSubtitle: 'Linux, Windows, Apple (macOS & iOS) und Android',
    tabOverview: 'Übersicht & GitHub',
    tabAndroid: 'Android (APK & AAB)',
    tabDesktop: 'Linux & Windows (.exe/.AppImage)',
    tabGitHub: 'GitHub-Actions-Workflow',
    readyForGitHub: 'Repository-Architektur bereit für GitHub:',
    initGitTitle: '1. Initialisieren und auf GitHub hochladen',
    mobileCardTitle: 'Mobilgeräte (Android & iOS)',
    mobileCardDesc: 'Capacitor erstellt APK/AAB für den Google Play Store und Xcode-Projekte für iPhone/iPad.',
    desktopCardTitle: 'Desktop (Linux, Windows, Mac)',
    desktopCardDesc: '100% kompatibel mit Electron für .exe-Installer, .deb / .AppImage und .dmg-Dateien.',
    androidGuideTitle: 'Android-Einrichtung & Build (Capacitor)',
    androidGuideDesc: 'Die capacitor.config.json ist vorbereitet. Führe diese Befehle mit Android Studio aus:',
    twaHint: 'PWA TWA Alternative: Verwende Google Bubblewrap CLI, um Android-Apps ohne nativen Code zu erstellen.',
    desktopGuideTitle: 'Desktop-Paketierung mit Electron (Linux, Windows, macOS)',
    desktopGuideDesc: 'Füge Electron hinzu, um eigenständige Desktop-Programme zu erstellen:',
    githubActionsTitle: 'GitHub Actions: Automatische Kompilierung & Veröffentlichung',
    githubActionsDesc: 'Die Datei .github/workflows/build-multiplatform.yml kompiliert automatisch Pakete für alle Systeme.',
    understandBtn: 'Verstanden',

    untitledQuiz: 'Neues unbenanntes Quiz',
    categoryLabel: 'Kategorie',
    categoryPlaceholder: 'Z. B. Geschichte, Naturwissenschaften, Geografie',
    categoryHint: 'Wähle eine vorhandene Kategorie oder gib einen neuen Namen ein. Die Kategorie wird mit dem Quiz gespeichert.',
    questionsCreated: 'Fragen erstellt',
    importJson: 'JSON importieren',
    exportJsonFile: 'Exportieren',
    saveQuiz: 'Quiz speichern',
    questionsSidebarTitle: 'Fragen',
    multipleChoice: 'Mehrfachauswahl',
    trueFalse: 'Wahr / Falsch',
    noQuestionText: 'Frage ohne Text',
    moveUp: 'Nach oben',
    moveDown: 'Nach unten',
    duplicate: 'Duplizieren',
    delete: 'Löschen',
    addMultipleChoice: 'Mehrfachauswahl (4 Optionen)',
    addTrueFalse: 'Wahr / Falsch',
    questionTextInputLabel: 'Fragetext',
    optionalMediaUrl: 'Optionales Bild oder Video (URL)',
    removeMedia: 'Entfernen',
    responseOptionsLabel: 'Antwortoptionen (richtige Antwort ankreuzen)',
    correctCount: 'richtig',
    explanationCuriosityLabel: 'Erklärung / Wissenswertes (nach Auflösung)',
    questionSettings: 'Frage-Einstellungen',
    timeLimitLabel: 'Zeitlimit',
    standardPointsLabel: 'Standard-Punkte',
    videoCheckpointLabel: 'Zeitpunkt im Video-Quiz (Sekunden)',
    videoCheckpointHint: 'Bei welcher Sekunde des Videos soll diese Frage erscheinen?',
  },
};
