import type { RegionId } from './types'

export type FlowKind = 'current' | 'wind'
export type Temperature = 'warm' | 'cold'

type Point = [number, number]

export interface Flow {
  id: string
  kind: FlowKind
  name: string
  aliases: string[]
  /** Courants : chaud ou froid (absent quand l'étiquette dépend de la saison). */
  temp?: Temperature
  regions: RegionId[]
  /** Tracés schématiques [lon, lat] dans le sens de l'écoulement ; une longitude peut dépasser ±180 pour franchir l'antiméridien. */
  paths: Point[][]
  /** Faux pour une zone sans direction (pot-au-noir). */
  arrows?: boolean
  note: string
}

const current = (
  id: string,
  name: string,
  temp: Temperature | undefined,
  regions: RegionId[],
  paths: Point[][],
  note: string,
  aliases: string[] = [],
): Flow => ({ id, kind: 'current', name, aliases, temp, regions, paths, note })

const wind = (
  id: string,
  name: string,
  regions: RegionId[],
  paths: Point[][],
  note: string,
  aliases: string[] = [],
  arrows = true,
): Flow => ({ id, kind: 'wind', name, aliases, regions, paths, arrows, note })

const CURRENTS: Flow[] = [
  current(
    'gulf-stream',
    'Gulf Stream',
    'warm',
    ['Atlantic'],
    [
      [
        [-81.5, 24.4],
        [-80, 26.5],
        [-79.4, 29.5],
        [-77.4, 33.2],
        [-74.6, 35.6],
        [-71.5, 37.6],
        [-67.5, 39.4],
        [-62, 40.8],
        [-56, 42],
        [-51, 43.2],
      ],
    ],
    'Grand courant né dans le golfe du Mexique : il adoucit le climat de l’Europe de l’Ouest.',
    ['Courant du Golfe', 'Stream du Golfe', 'Courant du Gulf Stream'],
  ),
  current(
    'derive-nord-atlantique',
    'Dérive nord-atlantique',
    'warm',
    ['Atlantic'],
    [
      [
        [-51, 43.2],
        [-44, 46.2],
        [-37, 49.3],
        [-29, 52.4],
        [-20, 55.5],
        [-12, 58.8],
        [-6, 61],
      ],
    ],
    'Prolongement du Gulf Stream vers l’Europe du Nord-Ouest.',
    ['Courant nord-atlantique', 'Dérive nord atlantique', 'Courant de dérive nord-atlantique'],
  ),
  current(
    'norvege',
    'Courant de Norvège',
    'warm',
    ['Atlantic'],
    [
      [
        [-6, 61],
        [-1.5, 61.9],
        [3, 62.4],
        [6.5, 64.4],
        [10, 66.3],
        [11, 68.2],
        [15, 70.4],
        [20, 71.6],
        [26, 72.3],
        [32, 72.9],
      ],
    ],
    'Branche chaude de la dérive nord-atlantique : elle garde les ports du nord de la Norvège libres de glace.',
    ['Courant norvégien'],
  ),
  current(
    'nord-equatorial-atl',
    'Courant nord-équatorial (Atlantique)',
    'warm',
    ['Atlantic'],
    [
      [
        [-22, 14.6],
        [-35, 14],
        [-47, 13.5],
        [-57, 13.8],
      ],
    ],
    'Va d’est en ouest, au nord de l’équateur : il pousse les eaux vers les Antilles.',
    ['Courant nord équatorial atlantique', 'Courant nord-équatorial', 'Courant équatorial nord'],
  ),
  current(
    'antilles',
    'Courant des Antilles',
    'warm',
    ['Atlantic'],
    [
      [
        [-58, 16.8],
        [-63, 19.4],
        [-68, 22],
        [-72, 25],
        [-75.5, 27],
        [-79.2, 28.3],
      ],
    ],
    'Contourne les Antilles par le nord et alimente le Gulf Stream.',
  ),
  current(
    'caraibes',
    'Courant des Caraïbes',
    'warm',
    ['Atlantic'],
    [
      [
        [-62, 13],
        [-70, 14],
        [-77, 14.5],
        [-83, 16.5],
        [-86.8, 19.4],
      ],
    ],
    'Traverse la mer des Caraïbes avant d’entrer dans le golfe du Mexique.',
    ['Courant caribéen'],
  ),
  current(
    'guinee',
    'Courant de Guinée',
    'warm',
    ['Atlantic'],
    [
      [
        [-12, 5.2],
        [-5, 3.8],
        [1, 3.6],
        [6.5, 3.1],
      ],
    ],
    'Longe le golfe de Guinée d’ouest en est.',
  ),
  current(
    'sud-equatorial-atl',
    'Courant sud-équatorial (Atlantique)',
    'warm',
    ['Atlantic'],
    [
      [
        [8, -1.5],
        [-5, -2],
        [-18, -2.5],
        [-30, -4],
        [-34.2, -4.8],
      ],
    ],
    'Traverse l’Atlantique d’est en ouest, juste sous l’équateur.',
    ['Courant sud équatorial atlantique', 'Courant sud-équatorial', 'Courant équatorial sud'],
  ),
  current(
    'bresil',
    'Courant du Brésil',
    'warm',
    ['Atlantic'],
    [
      [
        [-34, -8],
        [-36, -13],
        [-38.5, -19],
        [-41, -24],
        [-45.5, -29],
        [-50, -34.5],
        [-53, -38],
      ],
    ],
    'Descend le long des côtes brésiliennes.',
    ['Courant brésilien'],
  ),
  current(
    'malouines',
    'Courant des Malouines',
    'cold',
    ['Atlantic'],
    [
      [
        [-64, -55.5],
        [-60, -54],
        [-55.5, -52],
        [-55.5, -49],
        [-57, -45],
        [-56, -41],
        [-54, -38.5],
      ],
    ],
    'Remonte le long de la Patagonie.',
    ['Courant des Falkland', 'Courant des Falklands', 'Courant des îles Malouines'],
  ),
  current(
    'benguela',
    'Courant de Benguela',
    'cold',
    ['Atlantic'],
    [
      [
        [16.5, -37],
        [12.5, -32],
        [10.5, -26],
        [9, -20],
        [7, -14],
        [5, -9],
        [2, -5],
      ],
    ],
    'Remonte la côte sud-ouest de l’Afrique : il contribue à l’aridité du Namib.',
  ),
  current(
    'angola',
    'Courant d’Angola',
    'warm',
    ['Atlantic'],
    [
      [
        [8, -4],
        [10, -9],
        [11.5, -14],
        [11.6, -17],
      ],
    ],
    'Descend vers le sud jusqu’à rencontrer le courant froid de Benguela.',
  ),
  current(
    'canaries',
    'Courant des Canaries',
    'cold',
    ['Atlantic'],
    [
      [
        [-11, 40],
        [-13, 35.5],
        [-16, 31],
        [-20, 27.5],
        [-20.5, 23],
        [-20.5, 19],
        [-21, 15.5],
      ],
    ],
    'Longe le Portugal, le Maroc et le Sahara occidental.',
    ['Courant canarien'],
  ),
  current(
    'labrador',
    'Courant du Labrador',
    'cold',
    ['Atlantic'],
    [
      [
        [-57, 67],
        [-57, 63],
        [-54, 58],
        [-52, 54],
        [-50, 50],
        [-48, 46],
        [-49.5, 43.5],
      ],
    ],
    'Chargé d’icebergs, il rencontre le Gulf Stream au large de Terre-Neuve.',
  ),
  current(
    'est-groenland',
    'Courant est-groenlandais',
    'cold',
    ['Atlantic'],
    [
      [
        [-5, 79],
        [-9, 76],
        [-14, 73],
        [-19, 70],
        [-27, 67.5],
        [-34, 65],
        [-40, 62],
        [-44.5, 58.6],
      ],
    ],
    'Charrie la glace de l’Arctique le long du Groenland.',
    ['Courant du Groenland oriental', 'Courant du Groenland', 'Courant est groenlandais'],
  ),
  current(
    'kuroshio',
    'Kuroshio',
    'warm',
    ['Pacific'],
    [
      [
        [122.5, 16],
        [122.8, 20],
        [123, 24.5],
        [126.5, 28],
        [130, 30.2],
        [134, 32],
        [137, 33],
        [140, 34.2],
        [142.5, 35.5],
        [148, 36.5],
        [155, 37.5],
        [165, 38.5],
        [175, 39],
      ],
    ],
    '« Courant noir » : le Gulf Stream du Pacifique, chaud, qui longe le sud du Japon.',
    ['Courant du Kuroshio', 'Courant de Kuro-Shivo', 'Kuro-Shivo', 'Courant du Japon'],
  ),
  current(
    'derive-nord-pacifique',
    'Dérive nord-pacifique',
    'warm',
    ['Pacific'],
    [
      [
        [165, 40],
        [180, 41.5],
        [195, 43],
        [210, 45],
        [225, 47],
        [231, 48.5],
      ],
    ],
    'Prolonge le Kuroshio vers l’Amérique du Nord, où il se divise en courants de Californie et d’Alaska.',
    ['Courant nord-pacifique', 'Courant du Pacifique Nord', 'Dérive nord pacifique'],
  ),
  current(
    'californie',
    'Courant de Californie',
    'cold',
    ['Pacific'],
    [
      [
        [-129, 47.5],
        [-127, 44],
        [-125.8, 40],
        [-124.2, 35.5],
        [-121, 31],
        [-117.5, 26.5],
        [-113.5, 22],
        [-111, 18.5],
      ],
    ],
    'Rafraîchit la côte ouest des États-Unis (et ses brumes).',
    ['Courant californien'],
  ),
  current(
    'alaska',
    'Courant d’Alaska',
    'warm',
    ['Pacific'],
    [
      [
        [-130, 50],
        [-134, 54.5],
        [-139.5, 57.7],
        [-146.5, 58.8],
        [-151, 57.3],
        [-155, 55],
        [-159, 54.2],
        [-163, 53.5],
      ],
    ],
    'Fait le tour du golfe d’Alaska.',
  ),
  current(
    'oyashio',
    'Oyashio',
    'cold',
    ['Pacific'],
    [
      [
        [163, 57],
        [161, 52.5],
        [157, 48.5],
        [151.5, 45],
        [146.5, 41.8],
        [144.5, 38.5],
        [143, 36.5],
      ],
    ],
    '« Courant des parents » : froid, il descend de Kamtchatka et rencontre le Kuroshio au large du Japon, dans une mer très poissonneuse.',
    ['Courant de l’Oyashio', 'Courant d’Oya-Shivo', 'Oya-Shivo', 'Courant des Kouriles', 'Courant du Kamtchatka'],
  ),
  current(
    'nord-equatorial-pac',
    'Courant nord-équatorial (Pacifique)',
    'warm',
    ['Pacific'],
    [
      [
        [-110, 14],
        [-130, 14],
        [-150, 13.5],
        [-170, 13.5],
        [-190, 13.5],
        [-205, 13.3],
        [-220, 13],
        [-233, 13.3],
      ],
    ],
    'Traverse le Pacifique d’est en ouest, vers les Philippines.',
    ['Courant nord équatorial pacifique', 'Courant nord-équatorial', 'Courant équatorial nord'],
  ),
  current(
    'contre-courant-equatorial',
    'Contre-courant équatorial',
    'warm',
    ['Pacific'],
    [
      [
        [135, 6],
        [155, 6.5],
        [175, 7],
        [195, 7.5],
        [220, 7.5],
        [240, 8],
        [260, 8.5],
      ],
    ],
    'File vers l’est entre les deux courants équatoriaux, à contre-sens des alizés.',
    ['Contre courant équatorial', 'Contre-courant nord-équatorial'],
  ),
  current(
    'humboldt',
    'Courant de Humboldt',
    'cold',
    ['Pacific'],
    [
      [
        [-76, -42],
        [-77, -35],
        [-76, -27],
        [-77, -18],
        [-79, -11],
        [-81.5, -6],
        [-83, -3],
        [-87, -2],
      ],
    ],
    'Très poissonneux, il longe le Chili et le Pérou.',
    ['Courant du Pérou', 'Courant péruvien', 'Courant de Humbolt', 'Courant du Chili'],
  ),
  current(
    'sud-equatorial-pac',
    'Courant sud-équatorial (Pacifique)',
    'warm',
    ['Pacific'],
    [
      [
        [-90, -2],
        [-110, -3],
        [-130, -4],
        [-150, -5],
        [-170, -5.5],
        [-190, -5.5],
        [-205, -5],
        [-212, -4.5],
      ],
    ],
    'Traverse le Pacifique d’est en ouest, juste au sud de l’équateur.',
    ['Courant sud équatorial pacifique', 'Courant sud-équatorial', 'Courant équatorial sud'],
  ),
  current(
    'est-australien',
    'Courant est-australien',
    'warm',
    ['Pacific'],
    [
      [
        [152.5, -17],
        [154.5, -23.5],
        [155, -28],
        [154, -32.5],
        [152.5, -35.5],
        [151.5, -38.5],
      ],
    ],
    'Longe la côte est de l’Australie, de la Grande Barrière de corail à Sydney.',
    ['Courant d’Australie orientale', 'Courant est australien', 'Courant australien oriental'],
  ),
  current(
    'aiguilles',
    'Courant des Aiguilles',
    'warm',
    ['Indian'],
    [
      [
        [37, -23],
        [35.5, -27],
        [32.5, -31],
        [28, -34],
        [24, -35.9],
        [20.5, -37.2],
        [18, -39],
      ],
    ],
    'Rapide et puissant, il longe la côte sud-est de l’Afrique.',
    ['Courant du Cap des Aiguilles', 'Courant de Agulhas', 'Courant d’Agulhas', 'Agulhas'],
  ),
  current(
    'mozambique',
    'Courant du Mozambique',
    'warm',
    ['Indian'],
    [
      [
        [41, -11],
        [41, -16],
        [40, -20],
        [38, -23.5],
      ],
    ],
    'Descend le canal du Mozambique, entre l’Afrique et Madagascar.',
  ),
  current(
    'madagascar',
    'Courant de Madagascar',
    'warm',
    ['Indian'],
    [
      [
        [51, -18],
        [49.5, -24],
        [46.5, -27.5],
        [41, -30],
      ],
    ],
    'Longe la côte est de Madagascar avant de rejoindre le courant des Aiguilles.',
    ['Courant est-malgache', 'Courant malgache'],
  ),
  current(
    'somalie',
    'Courant de Somalie',
    undefined,
    ['Indian'],
    [
      [
        [43.5, -2],
        [47, 1.5],
        [51, 6.5],
        [54.5, 10.5],
      ],
    ],
    'Longe la Somalie et change de sens avec la mousson.',
    ['Courant somalien'],
  ),
  current(
    'sud-equatorial-ind',
    'Courant sud-équatorial (Indien)',
    'warm',
    ['Indian'],
    [
      [
        [115, -11],
        [95, -11.5],
        [75, -12],
        [60, -13.5],
        [51.5, -16],
      ],
    ],
    'Traverse l’océan Indien d’est en ouest, jusqu’à Madagascar.',
    ['Courant sud équatorial indien', 'Courant sud-équatorial', 'Courant équatorial sud'],
  ),
  current(
    'leeuwin',
    'Courant de Leeuwin',
    'warm',
    ['Indian'],
    [
      [
        [112, -22],
        [112, -27],
        [113.5, -31.5],
        [114.5, -35.2],
        [119, -36.3],
        [124, -35.7],
      ],
    ],
    'Descend la côte ouest de l’Australie, à contre-courant des eaux froides voisines.',
  ),
  current(
    'australie-occidentale',
    'Courant ouest-australien',
    'cold',
    ['Indian'],
    [
      [
        [111, -35],
        [108.5, -30],
        [107, -24],
        [108, -19],
        [109, -16],
      ],
    ],
    'Remonte au large de la côte ouest de l’Australie.',
    ['Courant d’Australie occidentale', 'Courant de l’Australie occidentale', 'Courant australien occidental'],
  ),
  current(
    'circumpolaire',
    'Courant circumpolaire antarctique',
    'cold',
    ['Atlantic', 'Pacific', 'Indian'],
    [
      [
        [-180, -57],
        [-150, -57],
        [-120, -57],
        [-90, -57],
        [-67, -57.4],
        [-55, -56],
        [-45, -54],
        [-30, -52.5],
        [-15, -51],
        [0, -50],
        [20, -49],
        [40, -48.5],
        [60, -49],
        [70, -51],
        [90, -52.5],
        [110, -53],
        [130, -53],
        [150, -53],
        [165, -55],
        [180, -57],
      ],
    ],
    'Seul courant qui fait le tour de la Terre : il encercle l’Antarctique d’ouest en est.',
    ['Courant circumpolaire', 'Courant antarctique', 'Dérive des vents d’ouest', 'Courant des vents d’ouest', 'ACC'],
  ),
]

const WINDS: Flow[] = [
  wind(
    'alizes-nord-est',
    'Alizés du nord-est',
    ['planetary'],
    [
      [
        [-18, 27],
        [-33, 19.5],
        [-48, 12],
      ],
      [
        [-112, 25],
        [-127, 18],
        [-142, 12],
      ],
      [
        [-165, 23],
        [-182, 17],
        [-198, 11],
      ],
    ],
    'Vents réguliers du nord-est vers l’équateur : les voiliers s’en servaient pour traverser l’Atlantique.',
    ['Alizés', 'Alizé du nord-est', 'Alizés boréaux', 'Alizé nord-est'],
  ),
  wind(
    'alizes-sud-est',
    'Alizés du sud-est',
    ['planetary'],
    [
      [
        [-10, -26],
        [-25, -15],
        [-38, -6],
      ],
      [
        [-100, -26],
        [-120, -16],
        [-140, -6],
      ],
      [
        [80, -28],
        [65, -18],
        [50, -10],
      ],
    ],
    'Vents réguliers du sud-est vers l’équateur, dans l’hémisphère sud.',
    ['Alizés', 'Alizé du sud-est', 'Alizés australs', 'Alizé sud-est'],
  ),
  wind(
    'vents-ouest',
    'Vents d’ouest',
    ['planetary'],
    [
      [
        [-58, 40.5],
        [-34, 45.5],
        [-10, 50],
      ],
      [
        [145, 40],
        [165, 44],
        [185, 47.5],
      ],
    ],
    'Vents dominants des latitudes tempérées : ils apportent les dépressions sur l’Europe.',
    ['Westerlies', 'Vents d’ouest dominants', 'Vents d’ouest tempérés'],
  ),
  wind(
    'quarantiemes',
    'Quarantièmes rugissants',
    ['planetary'],
    [
      [
        [-45, -40],
        [-15, -41],
        [15, -41],
      ],
      [
        [35, -41],
        [65, -42],
        [95, -42],
      ],
      [
        [-175, -42],
        [-145, -42],
        [-115, -42],
      ],
    ],
    'Vents d’ouest violents vers 40° de latitude sud, redoutés des navigateurs.',
    ['Les quarantièmes rugissants', '40es rugissants', 'Rugissants'],
  ),
  wind(
    'cinquantiemes',
    'Cinquantièmes hurlants',
    ['planetary'],
    [
      [
        [-50, -51.5],
        [-20, -52],
        [10, -51],
      ],
      [
        [30, -51.5],
        [60, -52],
        [90, -52.5],
      ],
      [
        [-175, -55],
        [-145, -55],
        [-115, -55],
      ],
    ],
    'Vents d’ouest encore plus forts vers 50° de latitude sud, au-dessus des mers australes.',
    ['Les cinquantièmes hurlants', '50es hurlants', 'Hurlants'],
  ),
  wind(
    'polaires-est',
    'Vents d’est polaires',
    ['planetary'],
    [
      [
        [150, 77],
        [110, 79],
        [70, 79],
      ],
      [
        [-85, 73],
        [-115, 73],
        [-145, 72],
      ],
    ],
    'Vents froids et secs qui soufflent d’est en ouest autour des pôles.',
    ['Vents polaires', 'Vents d’est', 'Easterlies polaires'],
  ),
  wind(
    'mousson-ete',
    'Mousson d’été',
    ['planetary', 'Asia'],
    [
      [
        [58, 5],
        [68, 12],
        [75, 18],
        [82, 24],
      ],
      [
        [88, 8],
        [92, 15],
        [96, 21],
      ],
    ],
    'Vent humide de sud-ouest : il apporte les pluies diluviennes sur l’Inde entre juin et septembre.',
    ['Mousson', 'Mousson du sud-ouest', 'Mousson humide', 'Mousson d’été indienne'],
  ),
  wind(
    'mousson-hiver',
    'Mousson d’hiver',
    ['planetary', 'Asia'],
    [
      [
        [86, 27],
        [82, 19],
        [78, 12],
      ],
      [
        [112, 28],
        [110, 19],
        [107, 10],
      ],
    ],
    'Vent sec de nord-est venu du continent : c’est la saison sèche en Asie du Sud.',
    ['Mousson', 'Mousson du nord-est', 'Mousson sèche', 'Mousson d’hiver indienne'],
  ),
  wind(
    'pot-au-noir',
    'Pot-au-noir',
    ['planetary'],
    [
      [
        [-42, 3],
        [-30, 5],
        [-18, 7.5],
        [-12, 9],
      ],
      [
        [-150, 7],
        [-130, 8],
        [-110, 9],
        [-95, 9.5],
      ],
    ],
    'Zone de calmes et d’orages près de l’équateur, où se rencontrent les alizés : la hantise des voiliers.',
    ['Calmes équatoriaux', 'Zone de convergence intertropicale', 'ZCIT', 'Doldrums'],
    false,
  ),
  wind(
    'jet-stream',
    'Jet-stream',
    ['planetary'],
    [
      [
        [-125, 38],
        [-100, 40],
        [-72, 43],
        [-42, 47],
        [-12, 51],
        [20, 50],
      ],
    ],
    'Rivière d’air très rapide, vers 10 km d’altitude, qui file d’ouest en est.',
    ['Jet stream', 'Courant-jet', 'Courant jet', 'Jet'],
  ),
  wind(
    'mistral',
    'Mistral',
    ['Europe'],
    [
      [
        [4.7, 46],
        [4.8, 44.5],
        [5.3, 43.2],
        [6.3, 41.8],
      ],
    ],
    'Vent froid et violent du nord qui descend la vallée du Rhône vers la Méditerranée.',
  ),
  wind(
    'tramontane',
    'Tramontane',
    ['Europe'],
    [
      [
        [1, 43.9],
        [2.4, 43.2],
        [3.7, 42.5],
        [5, 41.7],
      ],
    ],
    'Vent sec et violent de nord-ouest, entre Pyrénées et Massif central, vers le golfe du Lion.',
  ),
  wind(
    'bora',
    'Bora',
    ['Europe'],
    [
      [
        [15.5, 46.2],
        [14.2, 45.5],
        [13, 44.7],
        [12.3, 43.9],
      ],
    ],
    'Vent froid et en rafales qui dévale vers l’Adriatique, de Trieste à la Dalmatie.',
  ),
  wind(
    'sirocco',
    'Sirocco',
    ['Europe', 'Africa'],
    [
      [
        [9.5, 31],
        [11.5, 34.5],
        [13.5, 37.5],
        [15, 40.5],
      ],
    ],
    'Vent chaud et chargé de poussière venu du Sahara, qui souffle vers la Sicile et l’Italie.',
    ['Siroco'],
  ),
  wind(
    'levante',
    'Levante',
    ['Europe'],
    [
      [
        [-1.5, 36.5],
        [-4, 36.2],
        [-5.8, 36],
        [-8.5, 36],
      ],
    ],
    'Vent d’est qui s’engouffre dans le détroit de Gibraltar.',
    ['Levant'],
  ),
  wind(
    'meltem',
    'Meltem',
    ['Europe'],
    [
      [
        [25.5, 40.2],
        [25.5, 38.2],
        [26, 36],
        [26.5, 35.4],
      ],
    ],
    'Vent sec du nord qui souffle l’été sur la mer Égée.',
    ['Étésiens', 'Vents étésiens', 'Meltemi'],
  ),
  wind(
    'foehn',
    'Föhn',
    ['Europe'],
    [
      [
        [9, 45.5],
        [9.5, 46.6],
        [10, 47.6],
        [10.6, 48.5],
      ],
    ],
    'Vent chaud et sec qui dévale les Alpes sur le versant nord.',
    ['Foehn', 'Fœhn', 'Fen'],
  ),
  wind(
    'libeccio',
    'Libeccio',
    ['Europe'],
    [
      [
        [6.5, 40.8],
        [7.8, 42],
        [9.5, 43.4],
        [10.7, 44.1],
      ],
    ],
    'Vent de sud-ouest, souvent fort, qui balaie la Corse et la mer Tyrrhénienne.',
  ),
  wind(
    'harmattan',
    'Harmattan',
    ['Africa'],
    [
      [
        [14, 20],
        [8, 13.5],
        [3, 8],
        [1, 4.3],
      ],
    ],
    'Vent sec et poussiéreux du Sahara vers le golfe de Guinée, en saison sèche.',
  ),
  wind(
    'khamsin',
    'Khamsin',
    ['Africa'],
    [
      [
        [26, 25],
        [29.5, 28.5],
        [33, 31.5],
        [35, 33.5],
      ],
    ],
    'Vent chaud et sec du désert qui souffle sur l’Égypte au printemps.',
    ['Khamasin', 'Chamsin'],
  ),
  wind(
    'chergui',
    'Chergui',
    ['Africa'],
    [
      [
        [-2, 32],
        [-6, 33],
        [-9.5, 33.6],
      ],
    ],
    'Vent chaud et sec d’est qui vient du Sahara sur le Maroc.',
    ['Cherqui', 'Chergi'],
  ),
  wind(
    'shamal',
    'Shamal',
    ['Asia'],
    [
      [
        [42, 33],
        [46, 30],
        [50, 27.5],
        [54, 25.5],
      ],
    ],
    'Vent de nord-ouest qui souffle sur l’Irak et le golfe Persique.',
    ['Chamal'],
  ),
  wind(
    'loo',
    'Loo',
    ['Asia'],
    [
      [
        [70, 28],
        [76, 27.5],
        [82, 26],
        [87, 25.5],
      ],
    ],
    'Vent brûlant et sec d’ouest qui balaie la plaine du Gange avant la mousson.',
    ['Lu'],
  ),
  wind(
    'chinook',
    'Chinook',
    ['Americas'],
    [
      [
        [-123, 50.5],
        [-117, 51],
        [-111, 50.5],
        [-106, 50],
      ],
    ],
    'Vent chaud et sec qui descend les Rocheuses ; il « mange la neige » en quelques heures.',
  ),
  wind(
    'santa-ana',
    'Santa Ana',
    ['Americas'],
    [
      [
        [-113, 37],
        [-116, 35.5],
        [-118.2, 34.2],
        [-120.3, 33.3],
      ],
    ],
    'Vent sec du désert qui souffle vers la Californie du Sud et attise les incendies.',
    ['Santa Anas', 'Vents de Santa Ana'],
  ),
  wind(
    'zonda',
    'Zonda',
    ['Americas'],
    [
      [
        [-72, -32.5],
        [-69, -32.8],
        [-65.5, -33],
      ],
    ],
    'Vent chaud et sec qui descend les Andes côté argentin (type föhn).',
  ),
  wind(
    'pampero',
    'Pampero',
    ['Americas'],
    [
      [
        [-67, -40],
        [-63, -37],
        [-59, -34],
        [-55, -31],
      ],
    ],
    'Vent froid de sud-ouest qui traverse les Pampas d’Argentine.',
    ['Pampéro'],
  ),
]

export const FLOWS: Flow[] = [...CURRENTS, ...WINDS]
export const FLOW_BY_ID = new Map(FLOWS.map((f) => [f.id, f]))
