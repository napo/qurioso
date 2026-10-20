import { Quiz } from '../types/quiz';
import { DEMO_VIDEO_URL } from '../utils/videoSource';
import volcanoQuiz from '../../public/quizzes/tipi-di-vulcani.json';

export const SAMPLE_VIDEOS = [
  {
    id: 'big-buck-bunny-trailer',
    title: 'Big Buck Bunny — trailer dimostrativo',
    url: DEMO_VIDEO_URL,
    duration: 33,
  },
];

export const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: 'quiz-video-space',
    title: 'Video Quiz: Viaggio nello Spazio & Scienze',
    description: 'Il video avanza e si blocca a intervalli determinati o casuali per farti rispondere a quesiti scientifici!',
    category: 'Video Quiz & Scienza',
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    author: 'Maurizio Napolitano',
    createdAt: Date.now() - 3600000,
    settings: {
      pointsMultiplier: 1,
      showExplanation: true,
      streakBonus: true,
    },
    videoConfig: {
      videoUrl: DEMO_VIDEO_URL,
      videoTitle: 'Big Buck Bunny — trailer dimostrativo',
      videoType: 'sample',
      pauseMode: 'defined',
      checkpoints: [
        { timestamp: 5, questionId: 'vq-1' },
        { timestamp: 12, questionId: 'vq-2' },
        { timestamp: 20, questionId: 'vq-3' },
      ],
      randomConfig: {
        frequencySeconds: 10,
        totalCheckpoints: 3,
      }
    },
    questions: [
      {
        id: 'vq-1',
        text: 'Quale pianeta del nostro sistema solare è soprannominato il "Pianeta Rosso"?',
        type: 'multiple_choice',
        timeLimit: 15,
        points: 1000,
        videoTimestamp: 5,
        explanation: 'Marte appare rosso a causa dell\'abbondanza di ossido di ferro (ruggine) sulla sua superficie.',
        options: [
          { id: 'vq1-a', text: 'Marte', isCorrect: true, color: 'red', shape: 'triangle' },
          { id: 'vq1-b', text: 'Venere', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'vq1-c', text: 'Giove', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'vq1-d', text: 'Mercurio', isCorrect: false, color: 'green', shape: 'square' },
        ]
      },
      {
        id: 'vq-2',
        text: 'A che velocità viaggia approssimativamente la luce nel vuoto?',
        type: 'multiple_choice',
        timeLimit: 15,
        points: 1000,
        videoTimestamp: 12,
        explanation: 'La velocità della luce nel vuoto è esattamente 299.792.458 metri al secondo, circa 300.000 km/s.',
        options: [
          { id: 'vq2-a', text: '150.000 km/s', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'vq2-b', text: '300.000 km/s', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'vq2-c', text: '1.000.000 km/s', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'vq2-d', text: '30.000 km/s', isCorrect: false, color: 'green', shape: 'square' },
        ]
      },
      {
        id: 'vq-3',
        text: 'Vero o Falso: Il sole compone oltre il 99% della massa totale del nostro Sistema Solare.',
        type: 'true_false',
        timeLimit: 12,
        points: 1000,
        videoTimestamp: 20,
        explanation: 'Vero! Il Sole contiene circa il 99,86% della massa totale dell\'intero sistema solare.',
        options: [
          { id: 'vq3-a', text: 'Vero', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'vq3-b', text: 'Falso', isCorrect: false, color: 'red', shape: 'triangle' },
        ]
      }
    ]
  },
  {
    id: 'quiz-general-italy',
    title: 'Quiz Live: Cultura Generale & Italia',
    description: 'Quiz dal ritmo incalzante con 4 risposte colorate per sfidarsi live via QR Code!',
    category: 'Cultura Generale',
    coverImage: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&auto=format&fit=crop&q=80',
    author: 'Maurizio Napolitano',
    createdAt: Date.now() - 7200000,
    settings: {
      pointsMultiplier: 1,
      showExplanation: true,
      streakBonus: true,
    },
    questions: [
      {
        id: 'q1-1',
        text: 'Quale tra questi monumenti romani ha una cupola con un occhio aperto (oculus) in cima?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Il Pantheon ha una cupola in calcestruzzo con al centro un oculus di 9 metri di diametro.',
        mediaUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&auto=format&fit=crop&q=80',
        options: [
          { id: 'q1-1-a', text: 'Colosseo', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'q1-1-b', text: 'Pantheon', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'q1-1-c', text: 'Foro Romano', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'q1-1-d', text: 'Castel Sant\'Angelo', isCorrect: false, color: 'green', shape: 'square' },
        ]
      },
      {
        id: 'q1-2',
        text: 'Qual è il lago più grande d\'Italia per superficie?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Il Lago di Garda (detto anche Benaco) è il maggiore lago italiano con una superficie di circa 370 km².',
        options: [
          { id: 'q1-2-a', text: 'Lago di Como', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'q1-2-b', text: 'Lago Maggiore', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'q1-2-c', text: 'Lago di Garda', isCorrect: true, color: 'yellow', shape: 'circle' },
          { id: 'q1-2-d', text: 'Lago Trasimeno', isCorrect: false, color: 'green', shape: 'square' },
        ]
      },
      {
        id: 'q1-3',
        text: 'Chi ha dipinto la celebre opera "La nascita di Venere"?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Sandro Botticelli dipinse La nascita di Venere tra il 1482 e il 1485, oggi esposta agli Uffizi a Firenze.',
        options: [
          { id: 'q1-3-a', text: 'Leonardo da Vinci', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'q1-3-b', text: 'Michelangelo Buonarroti', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'q1-3-c', text: 'Raffaello Sanzio', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'q1-3-d', text: 'Sandro Botticelli', isCorrect: true, color: 'green', shape: 'square' },
        ]
      },
      {
        id: 'q1-4',
        text: 'Vero o Falso: La pizza Margherita prende il nome dalla Regina Margherita di Savoia.',
        type: 'true_false',
        timeLimit: 15,
        points: 1000,
        explanation: 'Vero! Nel 1889 il pizzaiolo Raffaele Esposito dedicò la pizza tricolore alla Regina Margherita.',
        options: [
          { id: 'q1-4-a', text: 'Vero', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'q1-4-b', text: 'Falso', isCorrect: false, color: 'red', shape: 'triangle' },
        ]
      }
    ]
  },
  {
    id: 'quiz-panoramic-world',
    title: 'Quiz Panoramico: Meraviglie del Mondo',
    description: 'Riconosci luoghi, capitali e meraviglie naturali dalle descrizioni e immagini panoramiche.',
    category: 'Geografia & Viaggi',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
    author: 'Maurizio Napolitano',
    createdAt: Date.now() - 86400000,
    settings: {
      pointsMultiplier: 1.5,
      showExplanation: true,
      streakBonus: true,
    },
    questions: [
      {
        id: 'pq-1',
        text: 'In quale stato si trova la celebre antica città rupestre di Petra, scolpita nella roccia rosa?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Petra è uno spettacolare sito archeologico situato nel deserto sud-occidentale della Giordania.',
        options: [
          { id: 'pq1-a', text: 'Egitto', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'pq1-b', text: 'Giordania', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'pq1-c', text: 'Oman', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'pq1-d', text: 'Libano', isCorrect: false, color: 'green', shape: 'square' },
        ]
      },
      {
        id: 'pq-2',
        text: 'Quale isola ospita la suggestiva scogliera vulcanica di Santorini con le tipiche cupole blu?',
        type: 'multiple_choice',
        timeLimit: 15,
        points: 1000,
        explanation: 'Santorini appartiene all\'arcipelago delle Cicladi nel Mar Egeo, in Grecia.',
        options: [
          { id: 'pq2-a', text: 'Grecia', isCorrect: true, color: 'red', shape: 'triangle' },
          { id: 'pq2-b', text: 'Spagna', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'pq2-c', text: 'Croazia', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'pq2-d', text: 'Portogallo', isCorrect: false, color: 'green', shape: 'square' },
        ]
      },
      {
        id: 'pq-3',
        text: 'Qual è il monte più alto d\'Europa (catena del Caucaso esclusa / nelle Alpi)?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Il Monte Bianco (4.808 m s.l.m.) è la montagna più alta delle Alpi e dell\'Europa occidentale.',
        options: [
          { id: 'pq3-a', text: 'Cervino', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'pq3-b', text: 'Monte Rosa', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'pq3-c', text: 'Monte Bianco', isCorrect: true, color: 'yellow', shape: 'circle' },
          { id: 'pq3-d', text: 'Gran Paradiso', isCorrect: false, color: 'green', shape: 'square' },
        ]
      }
    ]
  },
  volcanoQuiz as Quiz
];
