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

/** Bundled cover shared by the Italy sample quiz and new quizzes. */
export const DEFAULT_QUIZ_COVER: Pick<Quiz, 'coverImage' | 'coverAttribution'> = {
  coverImage: 'quizzes/covers/manarola.webp',
  coverAttribution: {
    title: 'Manarola, Cinque Terre (Italy).jpg',
    creator: 'Davcio',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Manarola,_Cinque_Terre_(Italy).jpg',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
    credit: 'Own work',
    attributionText: 'Davcio / Wikimedia Commons — CC BY-SA 3.0. Immagine ridimensionata rispetto all’originale.',
  },
};

export const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: 'quiz-video-space',
    title: 'Viaggio nello Spazio & Scienze',
    description: 'Il video avanza e si blocca a intervalli determinati o casuali per farti rispondere a quesiti scientifici!',
    category: 'Video Quiz & Scienza',
    coverImage: 'quizzes/covers/earth.webp',
    coverAttribution: {
      title: 'The Earth seen from Apollo 17.jpg',
      creator: 'NASA / Apollo 17 crew',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg',
      credit: 'NASA',
      attributionText: 'NASA / Apollo 17 crew / Wikimedia Commons — Pubblico dominio. Immagine ridimensionata rispetto all’originale.',
    },
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
    title: 'Cultura Generale & Italia',
    description: 'Quiz dal ritmo incalzante con 4 risposte colorate per sfidarsi live via QR Code!',
    category: 'Cultura Generale',
    ...DEFAULT_QUIZ_COVER,
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
        mediaUrl: 'quizzes/covers/colosseum.webp',
        mediaAttribution: {
          title: 'Colosseum in Rome, Italy - April 2007.jpg',
          creator: 'Diliff',
          license: 'CC BY-SA 2.5',
          sourceUrl: 'https://commons.wikimedia.org/wiki/File:Colosseum_in_Rome,_Italy_-_April_2007.jpg',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.5',
          credit: 'Own work',
          attributionText: 'Diliff / Wikimedia Commons — CC BY-SA 2.5. Immagine ridimensionata rispetto all’originale.',
        },
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
    coverImage: 'quizzes/covers/moraine-lake.webp',
    coverAttribution: {
      title: 'Moraine Lake 17092005.jpg',
      creator: 'Gorgo',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Moraine_Lake_17092005.jpg',
      credit: 'Own work',
      attributionText: 'Gorgo / Wikimedia Commons — Pubblico dominio. Immagine ridimensionata rispetto all’originale.',
    },
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
  {
    id: 'quiz-sample-united-kingdom',
    title: 'Discover the United Kingdom',
    description: 'Capitals, rivers, mountains and landmarks of the four UK nations.',
    category: 'Geography',
    coverImage: 'quizzes/covers/tower-bridge.webp',
    coverAttribution: {
      title: 'Tower bridge London Twilight - November 2006.jpg',
      creator: 'Diliff',
      license: 'CC BY-SA 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tower_bridge_London_Twilight_-_November_2006.jpg',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
      credit: 'Own work',
      attributionText: 'Diliff / Wikimedia Commons — CC BY-SA 3.0. Image resized from the original.',
    },
    author: 'Maurizio Napolitano',
    createdAt: Date.now() - 10800000,
    settings: {
      pointsMultiplier: 1,
      showExplanation: true,
      streakBonus: true,
    },
    questions: [
      {
        id: 'quiz-sample-united-kingdom-q1',
        text: 'What is the capital of Scotland?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Edinburgh is the capital of Scotland; the Scottish Parliament meets at Holyrood, in the city centre.',
        options: [
          { id: 'quiz-sample-united-kingdom-q1-a', text: 'Glasgow', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-united-kingdom-q1-b', text: 'Edinburgh', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-united-kingdom-q1-c', text: 'Aberdeen', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-united-kingdom-q1-d', text: 'Inverness', isCorrect: false, color: 'green', shape: 'square' },
        ],
      },
      {
        id: 'quiz-sample-united-kingdom-q2',
        text: 'Which river flows through central London?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'The Thames flows through London on its way to the North Sea. Tower Bridge crosses it near the Tower of London.',
        options: [
          { id: 'quiz-sample-united-kingdom-q2-a', text: 'Thames', isCorrect: true, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-united-kingdom-q2-b', text: 'Severn', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-united-kingdom-q2-c', text: 'Mersey', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-united-kingdom-q2-d', text: 'Tyne', isCorrect: false, color: 'green', shape: 'square' },
        ],
      },
      {
        id: 'quiz-sample-united-kingdom-q3',
        text: '“Big Ben” is the name of the great bell in the clock tower of the Palace of Westminster.',
        type: 'true_false',
        timeLimit: 20,
        points: 1000,
        explanation: 'True. The tower itself was renamed Elizabeth Tower in 2012; Big Ben is the nickname of its great bell.',
        options: [
          { id: 'quiz-sample-united-kingdom-q3-a', text: 'True', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-united-kingdom-q3-b', text: 'False', isCorrect: false, color: 'red', shape: 'triangle' },
        ],
      },
      {
        id: 'quiz-sample-united-kingdom-q4',
        text: 'Which is the highest mountain in the United Kingdom?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Ben Nevis, in the Scottish Highlands, rises to 1,345 metres above sea level.',
        options: [
          { id: 'quiz-sample-united-kingdom-q4-a', text: 'Snowdon (Yr Wyddfa)', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-united-kingdom-q4-b', text: 'Scafell Pike', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-united-kingdom-q4-c', text: 'Slieve Donard', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-united-kingdom-q4-d', text: 'Ben Nevis', isCorrect: true, color: 'green', shape: 'square' },
        ],
      },
      {
        id: 'quiz-sample-united-kingdom-q5',
        text: 'Which of these is NOT part of the United Kingdom?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'The UK is made up of England, Scotland, Wales and Northern Ireland. The Republic of Ireland is an independent country.',
        options: [
          { id: 'quiz-sample-united-kingdom-q5-a', text: 'Wales', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-united-kingdom-q5-b', text: 'Northern Ireland', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-united-kingdom-q5-c', text: 'Republic of Ireland', isCorrect: true, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-united-kingdom-q5-d', text: 'Scotland', isCorrect: false, color: 'green', shape: 'square' },
        ],
      },
    ],
  },
  {
    id: 'quiz-sample-germany',
    title: 'Deutschland entdecken',
    description: 'Flüsse, Berge, Städte und Wahrzeichen Deutschlands in fünf Fragen.',
    category: 'Geografie',
    coverImage: 'quizzes/covers/neuschwanstein.webp',
    coverAttribution: {
      title: 'Schloss Neuschwanstein 2013.jpg',
      creator: 'Thomas Wolf, www.foto-tw.de',
      license: 'CC BY-SA 3.0 DE',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Schloss_Neuschwanstein_2013.jpg',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/de/deed.en',
      credit: 'Own work',
      attributionText: 'Thomas Wolf, www.foto-tw.de / Wikimedia Commons — CC BY-SA 3.0 DE. Bild gegenüber dem Original verkleinert.',
    },
    author: 'Maurizio Napolitano',
    createdAt: Date.now() - 14400000,
    settings: {
      pointsMultiplier: 1,
      showExplanation: true,
      streakBonus: true,
    },
    questions: [
      {
        id: 'quiz-sample-germany-q1',
        text: 'Welcher Fluss fließt durch Köln?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Der Rhein fließt durch Köln; der Kölner Dom steht nur wenige Schritte von seinem Ufer entfernt.',
        options: [
          { id: 'quiz-sample-germany-q1-a', text: 'Elbe', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-germany-q1-b', text: 'Donau', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-germany-q1-c', text: 'Rhein', isCorrect: true, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-germany-q1-d', text: 'Main', isCorrect: false, color: 'green', shape: 'square' },
        ],
      },
      {
        id: 'quiz-sample-germany-q2',
        text: 'Wie viele Bundesländer hat Deutschland?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Deutschland besteht aus 16 Bundesländern, darunter die drei Stadtstaaten Berlin, Hamburg und Bremen.',
        options: [
          { id: 'quiz-sample-germany-q2-a', text: '16', isCorrect: true, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-germany-q2-b', text: '12', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-germany-q2-c', text: '14', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-germany-q2-d', text: '18', isCorrect: false, color: 'green', shape: 'square' },
        ],
      },
      {
        id: 'quiz-sample-germany-q3',
        text: 'Die Zugspitze ist der höchste Berg Deutschlands.',
        type: 'true_false',
        timeLimit: 20,
        points: 1000,
        explanation: 'Richtig. Die Zugspitze im Wettersteingebirge ist 2.962 Meter hoch und liegt an der Grenze zu Österreich.',
        options: [
          { id: 'quiz-sample-germany-q3-a', text: 'Wahr', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-germany-q3-b', text: 'Falsch', isCorrect: false, color: 'red', shape: 'triangle' },
        ],
      },
      {
        id: 'quiz-sample-germany-q4',
        text: 'In welcher Stadt steht das Brandenburger Tor?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Das Brandenburger Tor steht in Berlin am Pariser Platz und ist ein Symbol der deutschen Einheit.',
        options: [
          { id: 'quiz-sample-germany-q4-a', text: 'Potsdam', isCorrect: false, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-germany-q4-b', text: 'Berlin', isCorrect: true, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-germany-q4-c', text: 'Brandenburg an der Havel', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-germany-q4-d', text: 'Hamburg', isCorrect: false, color: 'green', shape: 'square' },
        ],
      },
      {
        id: 'quiz-sample-germany-q5',
        text: 'An welche beiden Meere grenzt Deutschland?',
        type: 'multiple_choice',
        timeLimit: 20,
        points: 1000,
        explanation: 'Im Norden grenzt Deutschland an die Nordsee und an die Ostsee.',
        options: [
          { id: 'quiz-sample-germany-q5-a', text: 'Nordsee und Ostsee', isCorrect: true, color: 'red', shape: 'triangle' },
          { id: 'quiz-sample-germany-q5-b', text: 'Ostsee und Mittelmeer', isCorrect: false, color: 'blue', shape: 'diamond' },
          { id: 'quiz-sample-germany-q5-c', text: 'Nordsee und Schwarzes Meer', isCorrect: false, color: 'yellow', shape: 'circle' },
          { id: 'quiz-sample-germany-q5-d', text: 'Adria und Ostsee', isCorrect: false, color: 'green', shape: 'square' },
        ],
      },
    ],
  },
  volcanoQuiz as Quiz
];
