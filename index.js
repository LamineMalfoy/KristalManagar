const { VK, createCollectIterator } = require("vk-io");
const commands = [];
// Делаем commands доступным глобально
global.commands = commands;
const database = require("./databases.js");
global.Config = require("./jsons/config.json");
const fs = require('fs');
const path = require('path');

const util = require("util");
const queryAsync = util.promisify(database.query).bind(database);
const databaseQuery = util.promisify(database.query);
require("dotenv").config();
const mutedUsersInfo = {};
global.mutedUsersInfo = mutedUsersInfo;

const silenceConf = {};
global.silenceConf = silenceConf;

// 🚀 ОПТИМИЗАЦИЯ: Подключаем кэширование и мониториунг
const cacheManager = require('./cache_manager.js');
const { performanceMonitor } = require('./performance_monitor.js');
const {
  getChatSettingsOptimized,
  getBanListOptimized,
  invalidateUserRole,
  invalidateChatSettings,
  invalidateBanList
} = require('./optimized_util.js');

// Импортируем getUserRole из roles.js БЕЗ кэширования
const { getUserRole } = require('./cmds/roles.js');
const { isSysBanned, checkSystemTables } = require('./cmds/sysadmin.js');
const logger = require('./logger.js');
const { checkGroupSubscription } = require('./middlewares/groupSubscriptionCheck.js');


(async () => {
  await checkSystemTables();
  logger.important('Системные таблицы проверены и готовы к использованию');
  
  // Создаем таблицу для блокировки чатов
  try {
    await databaseQuery(`
      CREATE TABLE IF NOT EXISTS chat_bans (
        chat_id BIGINT PRIMARY KEY,
        banned_by INT NOT NULL,
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason VARCHAR(500) DEFAULT 'Не указана'
      )
    `);
    logger.important('Таблица chat_bans готова к использованию');
  } catch (error) {
    logger.error('Ошибка при создании таблицы chat_bans:', error);
  }
})();

const { Keyboard } = require("vk-io");
const BonusReminderManager = require('./bonusReminder.js');
const vk = new VK({
  token: process.env.VK_TOKEN,
});
global.vk = vk;

// Инициализируем менеджер напоминаний о бонусах
const bonusReminder = new BonusReminderManager(vk);
vk.bonusReminder = bonusReminder;
module.exports = { vk };

// Глобальная защита от повторной выдачи бонуса (анти-спам кликов)
const processingBonuses = new Set();
global.processingBonuses = processingBonuses;
const golubev = new VK({
  token: process.env.VK_TOKEN,
});
global.golubev = golubev;
const utils = require("./util.js");
global.utils = utils;
const hnd = ["cmds"];
hnd.forEach((handler) => {
  require(`./handlers/${handler}.js`)(commands);
});

// Кэш для ID бота
let botId = null;

/**
 * Получает ID бота через VK API и кэширует его
 * @returns {Promise<number|null>} ID бота (отрицательное число) или null в случае ошибки
 */
async function getBotId() {
  if (botId !== null) {
    return botId; // Возвращаем кэшированное значение
  }

  try {
    logger.log('🔍 Получение ID бота через VK API...');
    const response = await vk.api.groups.getById({});

    if (response && response.groups && response.groups[0] && response.groups[0].id) {
      botId = -response.groups[0].id; // Делаем ID отрицательным для сообществ
      logger.log(`✅ ID бота получен и кэширован: ${botId} (${response.groups[0].name})`);
      return botId;
    } else {
      logger.error('❌ Не удалось получить ID бота: некорректный ответ API');
      return null;
    }
  } catch (error) {
    logger.error('❌ Ошибка при получении ID бота:', error.message || error);

    // Логируем дополнительную информацию для отладки
    if (error.code) {
      logger.error(`❌ Код ошибки VK API: ${error.code}`);
    }

    return null;
  }
}

// Инициализируем ID бота при запуске
(async () => {
  const id = await getBotId();
  global.botId = id;
  logger.log('🤖 Global botId установлен:', global.botId);
})();




const domainPatterns = {
  ru: /\.ru\b/,
  рф: /\.рф\b/,
  moscow: /\.moscow\b/,
  beer: /\.beer\b/,
  cc: /\.cc\b/,
  com: /\.com\b/,
  me: /\.me\b/,
  su: /\.su\b/,
  net: /\.net\b/,
  gg: /\.gg\b/,
  org: /\.org\b/,
  info: /\.info\b/,
  name: /\.name\b/,
  pw: /\.pw\b/,
  дети: /\.дети\b/,
  онлайн: /\.онлайн\b/,
  сайт: /\.сайт\b/,
  academy: /\.academy\b/,
  accountant: /\.accountant\b/,
  accountants: /\.accountants\b/,
  actor: /\.actor\b/,
  adult: /\.adult\b/,
  aero: /\.aero\b/,
  agency: /\.agency\b/,
  apartments: /\.apartments\b/,
  app: /\.app\b/,
  art: /\.art\b/,
  associates: /\.associates\b/,
  attorney: /\.attorney\b/,
  auction: /\.auction\b/,
  audio: /\.audio\b/,
  auto: /\.auto\b/,
  baby: /\.baby\b/,
  band: /\.band\b/,
  bar: /\.bar\b/,
  bargains: /\.bargains\b/,
  beer: /\.beer\b/,
  best: /\.best\b/,
  bet: /\.bet\b/,
  bid: /\.bid\b/,
  bike: /\.bike\b/,
  bingo: /\.bingo\b/,
  black: /\.black\b/,
  blackfriday: /\.blackfriday\b/,
  blue: /\.blue\b/,
  boutique: /\.boutique\b/,
  broker: /\.broker\b/,
  build: /\.build\b/,
  builders: /\.builders\b/,
  business: /\.business\b/,
  buzz: /\.buzz\b/,
  bzh: /\.bzh\b/,
  cab: /\.cab\b/,
  cafe: /\.cafe\b/,
  cam: /\.cam\b/,
  camera: /\.camera\b/,
  camp: /\.camp\b/,
  capital: /\.capital\b/,
  car: /\.car\b/,
  cards: /\.cards\b/,
  care: /\.care\b/,
  career: /\.career\b/,
  careers: /\.careers\b/,
  cars: /\.cars\b/,
  casa: /\.casa\b/,
  cash: /\.cash\b/,
  casino: /\.casino\b/,
  cat: /\.cat\b/,
  catering: /\.catering\b/,
  center: /\.center\b/,
  chat: /\.chat\b/,
  cheap: /\.cheap\b/,
  christmas: /\.christmas\b/,
  church: /\.church\b/,
  city: /\.city\b/,
  claims: /\.claims\b/,
  cleaning: /\.cleaning\b/,
  click: /\.click\b/,
  clinic: /\.clinic\b/,
  clothing: /\.clothing\b/,
  cloud: /\.cloud\b/,
  club: /\.club\b/,
  coach: /\.coach\b/,
  codes: /\.codes\b/,
  coffee: /\.coffee\b/,
  college: /\.college\b/,
  community: /\.community\b/,
  company: /\.company\b/,
  computer: /\.computer\b/,
  condos: /\.condos\b/,
  construction: /\.construction\b/,
  consulting: /\.consulting\b/,
  contractors: /\.contractors\b/,
  cooking: /\.cooking\b/,
  cool: /\.cool\b/,
  country: /\.country\b/,
  coupons: /\.coupons\b/,
  courses: /\.courses\b/,
  credit: /\.credit\b/,
  creditcard: /\.creditcard\b/,
  cricket: /\.cricket\b/,
  cruises: /\.cruises\b/,
  dance: /\.dance\b/,
  date: /\.date\b/,
  dating: /\.dating\b/,
  deals: /\.deals\b/,
  degree: /\.degree\b/,
  delivery: /\.delivery\b/,
  democrat: /\.democrat\b/,
  dental: /\.dental\b/,
  dentist: /\.dentist\b/,
  desi: /\.desi\b/,
  design: /\.design\b/,
  dev: /\.dev\b/,
  diamonds: /\.diamonds\b/,
  diet: /\.diet\b/,
  digital: /\.digital\b/,
  direct: /\.direct\b/,
  directory: /\.directory\b/,
  discount: /\.discount\b/,
  dog: /\.dog\b/,
  domains: /\.domains\b/,
  download: /\.download\b/,
  earth: /\.earth\b/,
  eco: /\.eco\b/,
  education: /\.education\b/,
  email: /\.email\b/,
  energy: /\.energy\b/,
  engineer: /\.engineer\b/,
  engineering: /\.engineering\b/,
  enterprises: /\.enterprises\b/,
  equipment: /\.equipment\b/,
  estate: /\.estate\b/,
  eus: /\.eus\b/,
  events: /\.events\b/,
  exchange: /\.exchange\b/,
  exnet: /\.exnet\b/,
  expert: /\.expert\b/,
  exposed: /\.exposed\b/,
  express: /\.express\b/,
  fail: /\.fail\b/,
  faith: /\.faith\b/,
  family: /\.family\b/,
  fans: /\.fans\b/,
  farm: /\.farm\b/,
  fashion: /\.fashion\b/,
  feedback: /\.feedback\b/,
  film: /\.film\b/,
  finance: /\.finance\b/,
  financial: /\.financial\b/,
  fish: /\.fish\b/,
  fishing: /\.fishing\b/,
  fit: /\.fit\b/,
  fitness: /\.fitness\b/,
  flights: /\.flights\b/,
  florist: /\.florist\b/,
  flowers: /\.flowers\b/,
  fm: /\.fm\b/,
  football: /\.football\b/,
  forex: /\.forex\b/,
  forsale: /\.forsale\b/,
  foundation: /\.foundation\b/,
  frl: /\.frl\b/,
  fun: /\.fun\b/,
  fund: /\.fund\b/,
  furniture: /\.furniture\b/,
  futbol: /\.futbol\b/,
  fyi: /\.fyi\b/,
  gallery: /\.gallery\b/,
  game: /\.game\b/,
  games: /\.games\b/,
  garden: /\.garden\b/,
  gent: /\.gent\b/,
  gift: /\.gift\b/,
  gifts: /\.gifts\b/,
  gives: /\.gives\b/,
  glass: /\.glass\b/,
  global: /\.global\b/,
  gmbh: /\.gmbh\b/,
  gold: /\.gold\b/,
  golf: /\.golf\b/,
  graphics: /\.graphics\b/,
  gratis: /\.gratis\b/,
  green: /\.green\b/,
  gripe: /\.gripe\b/,
  group: /\.group\b/,
  guide: /\.guide\b/,
  guitars: /\.guitars\b/,
  guru: /\.guru\b/,
  haus: /\.haus\b/,
  health: /\.health\b/,
  healthcare: /\.healthcare\b/,
  help: /\.help\b/,
  hiphop: /\.hiphop\b/,
  hiv: /\.hiv\b/,
  hockey: /\.hockey\b/,
  holdings: /\.holdings\b/,
  holiday: /\.holiday\b/,
  horse: /\.horse\b/,
  hospital: /\.hospital\b/,
  host: /\.host\b/,
  hosting: /\.hosting\b/,
  house: /\.house\b/,
  how: /\.how\b/,
  icu: /\.icu\b/,
  immo: /\.immo\b/,
  immobilien: /\.immobilien\b/,
  industries: /\.industries\b/,
  ink: /\.ink\b/,
  institute: /\.institute\b/,
  insure: /\.insure\b/,
  international: /\.international\b/,
  investments: /\.investments\b/,
  jetzt: /\.jetzt\b/,
  jewelry: /\.jewelry\b/,
  jobs: /\.jobs\b/,
  juegos: /\.juegos\b/,
  kaufen: /\.kaufen\b/,
  kim: /\.kim\b/,
  kitchen: /\.kitchen\b/,
  kiwi: /\.kiwi\b/,
  land: /\.land\b/,
  lawyer: /\.lawyer\b/,
  lease: /\.lease\b/,
  legal: /\.legal\b/,
  lgbt: /\.lgbt\b/,
  life: /\.life\b/,
  lighting: /\.lighting\b/,
  limited: /\.limited\b/,
  limo: /\.limo\b/,
  link: /\.link\b/,
  live: /\.live\b/,
  llc: /\.llc\b/,
  loan: /\.loan\b/,
  loans: /\.loans\b/,
  lol: /\.lol\b/,
  love: /\.love\b/,
  ltd: /\.ltd\b/,
  ltda: /\.ltda\b/,
  luxe: /\.luxe\b/,
  luxury: /\.luxury\b/,
  maison: /\.maison\b/,
  management: /\.management\b/,
  market: /\.market\b/,
  marketing: /\.marketing\b/,
  markets: /\.markets\b/,
  mba: /\.mba\b/,
  media: /\.media\b/,
  memorial: /\.memorial\b/,
  men: /\.men\b/,
  menu: /\.menu\b/,
  mobi: /\.mobi\b/,
  moda: /\.moda\b/,
  moe: /\.moe\b/,
  mom: /\.mom\b/,
  money: /\.money\b/,
  monster: /\.monster\b/,
  movie: /\.movie\b/,
  network: /\.network\b/,
  ninja: /\.ninja\b/,
  observer: /\.observer\b/,
  one: /\.one\b/,
  onl: /\.onl\b/,
  online: /\.online\b/,
  ooo: /\.ooo\b/,
  page: /\.page\b/,
  partners: /\.partners\b/,
  parts: /\.parts\b/,
  party: /\.party\b/,
  pet: /\.pet\b/,
  photo: /\.photo\b/,
  photography: /\.photography\b/,
  photos: /\.photos\b/,
  physio: /\.physio\b/,
  pics: /\.pics\b/,
  pictures: /\.pictures\b/,
  pink: /\.pink\b/,
  pizza: /\.pizza\b/,
  plumbing: /\.plumbing\b/,
  plus: /\.plus\b/,
  poker: /\.poker\b/,
  porn: /\.porn\b/,
  press: /\.press\b/,
  pro: /\.pro\b/,
  productions: /\.productions\b/,
  promo: /\.promo\b/,
  properties: /\.properties\b/,
  property: /\.property\b/,
  protection: /\.protection\b/,
  pub: /\.pub\b/,
  qpon: /\.qpon\b/,
  racing: /\.racing\b/,
  realty: /\.realty\b/,
  recipes: /\.recipes\b/,
  red: /\.red\b/,
  rehab: /\.rehab\b/,
  reisen: /\.reisen\b/,
  rent: /\.rent\b/,
  rentals: /\.rentals\b/,
  repair: /\.repair\b/,
  report: /\.report\b/,
  rest: /\.rest\b/,
  restaurant: /\.restaurant\b/,
  reviews: /\.reviews\b/,
  rip: /\.rip\b/,
  rocks: /\.rocks\b/,
  rodeo: /\.rodeo\b/,
  run: /\.run\b/,
  sale: /\.sale\b/,
  salon: /\.salon\b/,
  sarl: /\.sarl\b/,
  school: /\.school\b/,
  schule: /\.schule\b/,
  science: /\.science\b/,
  security: /\.security\b/,
  services: /\.services\b/,
  sex: /\.sex\b/,
  sexy: /\.sexy\b/,
  shiksha: /\.shiksha\b/,
  shoes: /\.shoes\b/,
  shop: /\.shop\b/,
  shopping: /\.shopping\b/,
  show: /\.show\b/,
  singles: /\.singles\b/,
  site: /\.site\b/,
  ski: /\.ski\b/,
  soccer: /\.soccer\b/,
  social: /\.social\b/,
  software: /\.software\b/,
  solar: /\.solar\b/,
  solutions: /\.solutions\b/,
  soy: /\.soy\b/,
  space: /\.space\b/,
  storage: /\.storage\b/,
  store: /\.store\b/,
  stream: /\.stream\b/,
  studio: /\.studio\b/,
  study: /\.study\b/,
  sucks: /\.sucks\b/,
  supplies: /\.supplies\b/,
  supply: /\.supply\b/,
  support: /\.support\b/,
  surf: /\.surf\b/,
  surgery: /\.surgery\b/,
  systems: /\.systems\b/,
  tattoo: /\.tattoo\b/,
  tax: /\.tax\b/,
  taxi: /\.taxi\b/,
  team: /\.team\b/,
  tech: /\.tech\b/,
  technology: /\.technology\b/,
  tel: /\.tel\b/,
  tennis: /\.tennis\b/,
  theater: /\.theater\b/,
  theatre: /\.theatre\b/,
  tienda: /\.tienda\b/,
  tips: /\.tips\b/,
  tires: /\.tires\b/,
  today: /\.today\b/,
  tools: /\.tools\b/,
  top: /\.top\b/,
  tours: /\.tours\b/,
  town: /\.town\b/,
  toys: /\.toys\b/,
  trade: /\.trade\b/,
  trading: /\.trading\b/,
  training: /\.training\b/,
  tube: /\.tube\b/,
  tv: /\.tv\b/,
  university: /\.university\b/,
  uno: /\.uno\b/,
  vacations: /\.vacations\b/,
  ventures: /\.ventures\b/,
  vet: /\.vet\b/,
  viajes: /\.viajes\b/,
  video: /\.video\b/,
  villas: /\.villas\b/,
  vin: /\.vin\b/,
  vip: /\.vip\b/,
  vision: /\.vision\b/,
  vodka: /\.vodka\b/,
  vote: /\.vote\b/,
  voto: /\.voto\b/,
  voyage: /\.voyage\b/,
  wang: /\.wang\b/,
  watch: /\.watch\b/,
  webcam: /\.webcam\b/,
  website: /\.website\b/,
  wedding: /\.wedding\b/,
  whoswho: /\.whoswho\b/,
  wiki: /\.wiki\b/,
  win: /\.win\b/,
  wine: /\.wine\b/,
  work: /\.work\b/,
  works: /\.works\b/,
  world: /\.world\b/,
  wtf: /\.wtf\b/,
  xxx: /\.xxx\b/,
  xyz: /\.xyz\b/,
  yoga: /\.yoga\b/,
  zone: /\.zone\b/,
  realestate: /\.realestate\b/,
  fan: /\.fan\b/,
  art: /\.art\b/,
  bar: /\.bar\b/,
  college: /\.college\b/,
  design: /\.design\b/,
  dev: /\.dev\b/,
  feedback: /\.feedback\b/,
  host: /\.host\b/,
  ink: /\.ink\b/,
  love: /\.love\b/,
  observer: /\.observer\b/,
  online: /\.online\b/,
  press: /\.press\b/,
  protection: /\.protection\b/,
  radio_am: /\.radio\.am\b/,
  radio_fm: /\.radio\.fm\b/,
  realty: /\.realty\b/,
  rent: /\.rent\b/,
  rest: /\.rest\b/,
  security: /\.security\b/,
  shop: /\.shop\b/,
  site: /\.site\b/,
  space: /\.space\b/,
  store: /\.store\b/,
  tattoo: /\.tattoo\b/,
  tech: /\.tech\b/,
  tel: /\.tel\b/,
  theatre: /\.theatre\b/,
  tv: /\.tv\b/,
  website: /\.website\b/,
  wiki: /\.wiki\b/,
  xyz: /\.xyz\b/,
  eu: /\.eu\b/,
  eu_com: /\.eu\.com\b/,
  at: /\.at\b/,
  co_at: /\.co\.at\b/,
  or_at: /\.or\.at\b/,
  be: /\.be\b/,
  ch: /\.ch\b/,
  cz: /\.cz\b/,
  es: /\.es\b/,
  com_es: /\.com\.es\b/,
  nom_es: /\.nom\.es\b/,
  org_es: /\.org\.es\b/,
  gb_net: /\.gb\.net\b/,
  gr_com: /\.gr\.com\b/,
  hu_net: /\.hu\.net\b/,
  im: /\.im\b/,
  co_im: /\.co\.im\b/,
  com_im: /\.com\.im\b/,
  net_im: /\.net\.im\b/,
  org_im: /\.org\.im\b/,
  li: /\.li\b/,
  lt: /\.lt\b/,
  lu: /\.lu\b/,
  lv: /\.lv\b/,
  ans_lv: /\.ans\.lv\b/,
  com_lv: /\.com\.lv\b/,
  conf_lv: /\.conf\.lv\b/,
  edu_lv: /\.edu\.lv\b/,
  id_lv: /\.id\.lv\b/,
  net_lv: /\.net\.lv\b/,
  org_lv: /\.org\.lv\b/,
  me: /\.me\b/,
  nl: /\.nl\b/,
  pl: /\.pl\b/,
  com_pl: /\.com\.pl\b/,
  net_pl: /\.net\.pl\b/,
  org_pl: /\.org\.pl\b/,
  info_pl: /\.info\.pl\b/,
  biz_pl: /\.biz\.pl\b/,
  edu_pl: /\.edu\.pl\b/,
  nom_pl: /\.nom\.pl\b/,
  shop_pl: /\.shop\.pl\b/,
  waw_pl: /\.waw\.pl\b/,
  se_net: /\.se\.net\b/,
  si: /\.si\b/,
  sk: /\.sk\b/,
  co_uk: /\.co\.uk\b/,
  org_uk: /\.org\.uk\b/,
  me_uk: /\.me\.uk\b/,
  uk_com: /\.uk\.com\b/,
  uk_net: /\.uk\.net\b/,
  london: /\.london\b/,
  gr: /\.gr\b/,
  ro: /\.ro\b/,
  com_ro: /\.com\.ro\b/,
  fi: /\.fi\b/,
  de: /\.de\b/,
  com_de: /\.com\.de\b/,
  de_com: /\.de\.com\b/,
  berlin: /\.berlin\b/,
  koeln: /\.koeln\b/,
  cologne: /\.cologne\b/,
  hamburg: /\.hamburg\b/,
  wien: /\.wien\b/,
  bayern: /\.bayern\b/,
  scot: /\.scot\b/,
  brussels: /\.brussels\b/,
  vlaanderen: /\.vlaanderen\b/,
  wales: /\.wales\b/,
  cymru: /\.cymru\b/,
  melbourne: /\.melbourne\b/,
  lat: /\.lat\b/,
  gent: /\.gent\b/,
  saarland: /\.saarland\b/,
  ist: /\.ist\b/,
  istanbul: /\.istanbul\b/,
  asia: /\.asia\b/,
  ae: /\.ae\b/,
  ae_org: /\.ae\.org\b/,
  af: /\.af\b/,
  com_af: /\.com\.af\b/,
  net_af: /\.net\.af\b/,
  org_af: /\.org\.af\b/,
  ai: /\.ai\b/,
  cn_com: /\.cn\.com\b/,
  cx: /\.cx\b/,
  christmas: /\.christmas\b/,
  in: /\.in\b/,
  co_in: /\.co\.in\b/,
  net_in: /\.net\.in\b/,
  in_net: /\.in\.net\b/,
  org_in: /\.org\.in\b/,
  gen_in: /\.gen\.in\b/,
  firm_in: /\.firm\.in\b/,
  ind_in: /\.ind\.in\b/,
  io: /\.io\b/,
  jp: /\.jp\b/,
  jp_net: /\.jp\.net\b/,
  jpn_com: /\.jpn\.com\b/,
  tokyo: /\.tokyo\b/,
  nagoya: /\.nagoya\b/,
  yokohama: /\.yokohama\b/,
  la: /\.la\b/,
  mn: /\.mn\b/,
  my: /\.my\b/,
  com_my: /\.com\.my\b/,
  net_my: /\.net\.my\b/,
  org_my: /\.org\.my\b/,
  pk: /\.pk\b/,
  ph: /\.ph\b/,
  com_ph: /\.com\.ph\b/,
  net_ph: /\.net\.ph\b/,
  org_ph: /\.org\.ph\b/,
  qa: /\.qa\b/,
  sa_com: /\.sa\.com\b/,
  tl: /\.tl\b/,
  tw: /\.tw\b/,
  com_tw: /\.com\.tw\b/,
  idv_tw: /\.idv\.tw\b/,
  club_tw: /\.club\.tw\b/,
  ebiz_tw: /\.ebiz\.tw\b/,
  game_tw: /\.game\.tw\b/,
  to: /\.to\b/,
  us: /\.us\b/,
  us_com: /\.us\.com\b/,
  us_org: /\.us\.org\b/,
  ag: /\.ag\b/,
  co_ag: /\.co\.ag\b/,
  com_ag: /\.com\.ag\b/,
  net_ag: /\.net\.ag\b/,
  org_ag: /\.org\.ag\b/,
  nom_ag: /\.nom\.ag\b/,
  br_com: /\.br\.com\b/,
  bz: /\.bz\b/,
  co_bz: /\.co\.bz\b/,
  com_bz: /\.com\.bz\b/,
  net_bz: /\.net\.bz\b/,
  org_bz: /\.org\.bz\b/,
  quebec: /\.quebec\b/,
  cl: /\.cl\b/,
  com_co: /\.com\.co\b/,
  co_com: /\.co\.com\b/,
  net_co: /\.net\.co\b/,
  nom_co: /\.nom\.co\b/,
  ec: /\.ec\b/,
  com_ec: /\.com\.ec\b/,
  net_ec: /\.net\.ec\b/,
  info_ec: /\.info\.ec\b/,
  pro_ec: /\.pro\.ec\b/,
  med_ec: /\.med\.ec\b/,
  fin_ec: /\.fin\.ec\b/,
  gl: /\.gl\b/,
  co_gl: /\.co\.gl\b/,
  com_gl: /\.com\.gl\b/,
  net_gl: /\.net\.gl\b/,
  org_gl: /\.org\.gl\b/,
  gs: /\.gs\b/,
  gy: /\.gy\b/,
  co_gy: /\.co\.gy\b/,
  com_gy: /\.com\.gy\b/,
  net_gy: /\.net\.gy\b/,
  hn: /\.hn\b/,
  com_hn: /\.com\.hn\b/,
  net_hn: /\.net\.hn\b/,
  org_hn: /\.org\.hn\b/,
  ht: /\.ht\b/,
  com_ht: /\.com\.ht\b/,
  net_ht: /\.net\.ht\b/,
  org_ht: /\.org\.ht\b/,
  info_ht: /\.info\.ht\b/,
  lc: /\.lc\b/,
  co_lc: /\.co\.lc\b/,
  com_lc: /\.com\.lc\b/,
  net_lc: /\.net\.lc\b/,
  org_lc: /\.org\.lc\b/,
  mx: /\.mx\b/,
  com_mx: /\.com\.mx\b/,
  mex_com: /\.mex\.com\b/,
  pe: /\.pe\b/,
  com_pe: /\.com\.pe\b/,
  net_pe: /\.net\.pe\b/,
  org_pe: /\.org\.pe\b/,
  sr: /\.sr\b/,
  sx: /\.sx\b/,
  vc: /\.vc\b/,
  com_vc: /\.com\.vc\b/,
  net_vc: /\.net\.vc\b/,
  org_vc: /\.org\.vc\b/,
  co_ve: /\.co\.ve\b/,
  com_ve: /\.com\.ve\b/,
  vegas: /\.vegas\b/,
  nyc: /\.nyc\b/,
  miami: /\.miami\b/,
  boston: /\.boston\b/,
  ac: /\.ac\b/,
  africa: /\.africa\b/,
  as: /\.as\b/,
  cc: /\.cc\b/,
  cm: /\.cm\b/,
  co_cm: /\.co\.cm\b/,
  com_cm: /\.com\.cm\b/,
  net_cm: /\.net\.cm\b/,
  fm: /\.fm\b/,
  radio_fm: /\.radio\.fm\b/,
  gg: /\.gg\b/,
  je: /\.je\b/,
  ly: /\.ly\b/,
  com_ly: /\.com\.ly\b/,
  ms: /\.ms\b/,
  mu: /\.mu\b/,
  com_mu: /\.com\.mu\b/,
  net_mu: /\.net\.mu\b/,
  org_mu: /\.org\.mu\b/,
  nf: /\.nf\b/,
  com_nf: /\.com\.nf\b/,
  net_nf: /\.net\.nf\b/,
  org_nf: /\.org\.nf\b/,
  ng: /\.ng\b/,
  com_ng: /\.com\.ng\b/,
  nu: /\.nu\b/,
  nz: /\.nz\b/,
  co_nz: /\.co\.nz\b/,
  net_nz: /\.net\.nz\b/,
  org_nz: /\.org\.nz\b/,
  com_sb: /\.com\.sb\b/,
  net_sb: /\.net\.sb\b/,
  org_sb: /\.org\.sb\b/,
  sc: /\.sc\b/,
  com_sc: /\.com\.sc\b/,
  net_sc: /\.net\.sc\b/,
  org_sc: /\.org\.sc\b/,
  sh: /\.sh\b/,
  so: /\.so\b/,
  st: /\.st\b/,
  tk: /\.tk\b/,
  ws: /\.ws\b/,
};

const detectLinks = (text) => {
  if (!text) return [];

  const linkRegex = /\b(?:https?:\/\/|ftp:\/\/|www\.)?[-A-Z0-9+&@#\/%?=~_|!:,.;]*[A-Z0-9+&@#\/%=~_|]/gi;
  const matches = text.match(linkRegex);

  const detectedLinks = [];

  if (matches) {
    matches.forEach((link) => {
      let hostname;

      try {
        if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("ftp://")) {
          const url = new URL(link);
          hostname = url.hostname.toLowerCase();
        } else {
          // Для ссылок без протокола
          const urlParts = link.split("/");
          hostname = urlParts[0].toLowerCase();
        }

        // Проверяем по регулярным выражениям доменов
        for (const key in domainPatterns) {
          if (domainPatterns.hasOwnProperty(key)) {
            if (domainPatterns[key].test(hostname)) {
              detectedLinks.push({ url: link, domain: key });
              break;
            }
          }
        }
      } catch (error) {
        // Если не удалось разобрать URL, просто добавляем ссылку
        detectedLinks.push({ url: link, domain: 'unknown' });
      }
    });
  }

  return detectedLinks;
};

// Добавляем систему отслеживания сообщений для анти-спама
const userMessages = {};

// Функция для проверки спама
function checkSpam(userId, peerId, text) {
  if (!userMessages[peerId]) {
    userMessages[peerId] = {};
  }

  if (!userMessages[peerId][userId]) {
    userMessages[peerId][userId] = {
      messages: [],
      warnings: 0,
      lastWarning: 0
    };
  }

  const now = Date.now();
  const userInfo = userMessages[peerId][userId];

  // Удаляем сообщения старше 5 секунд
  userInfo.messages = userInfo.messages.filter(msg => now - msg.time < 5000);

  // Добавляем текущее сообщение
  userInfo.messages.push({
    text: text,
    time: now
  });

  // Проверяем на спам (более 5 сообщений за 5 секунд)
  if (userInfo.messages.length > 5) {
    return true;
  }

  // Проверяем на повторяющиеся сообщения
  if (userInfo.messages.length >= 3) {
    const lastThreeMessages = userInfo.messages.slice(-3);
    if (lastThreeMessages[0].text === lastThreeMessages[1].text &&
      lastThreeMessages[1].text === lastThreeMessages[2].text) {
      return true;
    }
  }

  return false;
}

// Функция для получения описания контента
function getContentDescription(attachmentType) {
  switch (attachmentType) {
    case 'stickers':
      return 'был стикер';
    case 'docs':
      return 'был документ';
    case 'reposts':
      return 'был репост записи';
    case 'images':
      return 'было изображение';
    case 'video':
      return 'было видео';
    default:
      return 'был запрещённый контент';
  }
}

vk.updates.on("message", async (context, next) => {
  // 🚀 ОПТИМИЗАЦИЯ: Мониторинг производительности
  const timerId = performanceMonitor.startTimer('message_handler', {
    peerId: context.peerId,
    senderId: context.senderId
  });

  try {
    // Проверка режима удаления сообщений
    const silenceMode = global.silenceModes && global.silenceModes[context.peerId];
    if (silenceMode && silenceMode.mode === 'delete') {
      // Проверяем права пользователя
      const userRole = await getUserRole(context.peerId, context.senderId);
      
      // Не удаляем сообщения администраторов и звезд (роль 20+)
      if (userRole < 20 && context.senderId !== silenceMode.adminId) {
        try {
          // Быстро удаляем сообщение
          await vk.api.messages.delete({
            delete_for_all: 1,
            peer_id: context.peerId,
            cmids: context.conversationMessageId,
          });
          
          logger.log(`[SILENCE DELETE] Удалено сообщение от ${context.senderId} в чате ${context.peerId}`);
          return; // Прерываем обработку сообщения
        } catch (error) {
          logger.error('Ошибка при удалении сообщения в режиме тишины:', error);
        }
      }
    }

    // Проверка обязательных подписок на сообщества
    const subscriptionCheckPassed = await checkGroupSubscription(context);
    if (!subscriptionCheckPassed) {
      return; // Прерываем обработку, если пользователь не подписан на нужные группы
    }

    // Ранний лог текста сообщения для диагностики
    if (typeof context.text === 'string') {
      logger.log('[MSG TEXT]', { peerId: context.peerId, senderId: context.senderId, text: context.text });
      const t = context.text.trim().toLowerCase();
      const norm = t.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '');
      logger.log('[RP DEBUG]', { t, norm, codes: Array.from(norm).map(ch => ch.charCodeAt(0)) });
      if (!norm.startsWith('/') && /(обнять|обниму|обнимашки|чмок|чмокну|чмокнуть|поцеловать|поцелуй|поцелую|целую|погладить|поглажу)(?:\s|$|[^a-zA-Zа-яА-ЯёЁ0-9_])/.test(norm)) {
        logger.log('[RP pre-check] potential trigger detected');
      }
    }

    // Проверка на фильтр запрещенных слов
    if (context.text && context.senderId > 0) {
      const filterFile = path.join(__dirname, 'data', 'filters', `${context.peerId}.json`);
      if (fs.existsSync(filterFile)) {
        try {
          const filterData = fs.readFileSync(filterFile, 'utf8');
          const filters = JSON.parse(filterData);

          if (filters && filters.length > 0) {
            const userRole = await getUserRole(context.peerId, context.senderId);

            // Не проверяем модераторов и выше
            if (userRole < 20) {
              const messageText = context.text.toLowerCase();

              // Проверяем каждое запрещенное слово
              for (const forbiddenWord of filters) {
                if (messageText.includes(forbiddenWord)) {
                  try {
                    // Получаем информацию о пользователе
                    const userInfo = await vk.api.users.get({ user_ids: [context.senderId] });
                    const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'пользователя';

                    // Удаляем сообщение
                    await vk.api.messages.delete({
                      delete_for_all: 1,
                      peer_id: context.peerId,
                      cmids: context.conversationMessageId,
                    });

                    // Отправляем уведомление
                    context.send({
                      message: `⛔ Сообщение [id${context.senderId}|${userName}] было удалено, так как содержало запрещенное слово.\n\n📝 Список запрещенных слов можно посмотреть командой: /filter all`,
                    });

                    return;
                  } catch (error) {
                    logger.error('Ошибка при удалении сообщения с запрещенным словом:', error);
                  }
                }
              }
            }
          }
        } catch (error) {
          logger.error('Ошибка при проверке фильтра слов:', error);
        }
      }
    }

    // === RP-действия для пар (обнять/чмок/поцеловать/погладить) без слеша ===
    if (context.text && !context.text.startsWith('/')) {
      const rawText = context.text;
      const text = rawText.trim().toLowerCase();
      const norm = text.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '');
      // расширенные синонимы
      let triggerMatch = norm.match(/^\s*(обнять|обниму|обнимашки|чмок|чмокну|чмокнуть|поцеловать|поцелуй|поцелую|целую|погладить|поглажу)(?:\s|$|[^a-zA-Zа-яА-ЯёЁ0-9_])/);
      // Временный fallback на точный 'чмок' для диагностики
      if (!triggerMatch && norm === 'чмок') {
        triggerMatch = ['чмок', 'чмок'];
      }
      if (triggerMatch) {
        logger.log('[RP] Trigger detected:', { peerId: context.peerId, senderId: context.senderId, text: norm });
        // Убрано временное диагностическое сообщение в чат
        const trigger = triggerMatch[1];
        try {
          // 1) Определяем цель: ответ на сообщение или аргумент после триггера
          let targetId = null;
          // reply (два варианта свойств для надёжности)
          if (context.replyMessage && context.replyMessage.senderId) {
            targetId = context.replyMessage.senderId;
          } else if (context.message && context.message.reply_message && context.message.reply_message.from_id) {
            targetId = context.message.reply_message.from_id;
          } else {
            const parts = norm.split(/\s+/);
            if (parts.length > 1) {
              try {
                const { extractNumericId } = require('./cmds/ban.js');
                targetId = await extractNumericId(parts[1]);
              } catch (_) {}
              // fallback на простые форматы
              if (!targetId) {
                const m = parts[1].match(/^\[id(\d+)\|/);
                if (m) targetId = parseInt(m[1], 10);
              }
            }
          }
          logger.log('[RP] Target resolved (pre-marriage):', { targetId });

          // 2) Проверяем брак (нужно и для авто-определения цели)
          const marriagesPath = path.join(__dirname, 'data', `marriages_${context.peerId}.json`);
          let marriages = [];
          try {
            const data = await fs.promises.readFile(marriagesPath, 'utf8');
            marriages = JSON.parse(data || '[]');
          } catch (_) {
            marriages = [];
          }

          const myMarriage = marriages.find(m => m.user1 === context.senderId || m.user2 === context.senderId);
          if (!myMarriage) {
            logger.log('[RP] No marriage found for sender');
            const actorLink = (await utils.getlink(context.senderId)) || `[id${context.senderId}|Пользователь]`;
            await context.reply(`💔 ${actorLink}, действие доступно только для супругов.\nℹ️ Заключите брак, чтобы использовать RP-действия.`);
            return;
          }

          const partnerId = myMarriage.user1 === context.senderId ? myMarriage.user2 : myMarriage.user1;

          // Если цели нет — по умолчанию действуем на супруга/супругу
          if (!targetId) {
            targetId = partnerId;
          }
          logger.log('[RP] Partner & final target:', { partnerId, targetId });

          // Нельзя на себя
          if (targetId === context.senderId) {
            const actorLink = (await utils.getlink(context.senderId)) || `[id${context.senderId}|Пользователь]`;
            await context.reply(`⚠️ ${actorLink}, нельзя выполнить это действие на самого себя.`);
            return;
          }
          
          if (partnerId !== targetId) {
            const actorLink = (await utils.getlink(context.senderId)) || `[id${context.senderId}|Пользователь]`;
            const partnerLink = (await utils.getlink(partnerId)) || `[id${partnerId}|Партнёр]`;
            await context.reply(`⚠️ ${actorLink}, это действие доступно только для вашей пары — ${partnerLink}.`);
            return;
          }

          // 3) Определяем пол отправителя для правильного глагола
          let sex = 0; // 1 — жен, 2 — муж
          try {
            const u = await vk.api.users.get({ user_ids: String(context.senderId), fields: 'sex' });
            if (u && u[0] && typeof u[0].sex === 'number') sex = u[0].sex;
          } catch (_) {}

          const isFemale = sex === 1;
          const verbs = {
            обнять: isFemale ? 'обняла' : 'обнял',
            поцеловать: isFemale ? 'поцеловала' : 'поцеловал',
            чмок: isFemale ? 'чмокнула' : 'чмокнул',
            погладить: isFemale ? 'погладила' : 'погладил'
          };

          // 4) Категории фото согласно заданию
          const owner = '-230511380';
          const photos = {
            hug: ['457239058', '457239060', '457239061', '457239062', '457239067'],
            kiss: ['457239059', '457239065', '457239066', '457239068', '457239069', '457239070', '457239071', '457239072'],
            pet: ['457239064']
          };

          let pool = [];
          if (trigger === 'обнять') pool = photos.hug;
          else if (trigger === 'погладить') pool = photos.pet;
          else if (trigger === 'чмок' || trigger === 'поцеловать') pool = photos.kiss;

          const attachment = pool.length > 0
            ? `photo${owner}_${pool[Math.floor(Math.random() * pool.length)]}`
            : undefined;

          // 5) Красивый текст с кликабельными именами
          const actor = await utils.getlink(context.senderId) || `[id${context.senderId}|Пользователь]`;
          const target = await utils.getlink(targetId) || `[id${targetId}|Пользователь]`;

          const verb = verbs[trigger] || 'сделал(а)';
          const emojis = trigger === 'обнять' ? '🤗'
                        : (trigger === 'погладить' ? '🫶'
                        : '💋');

          const msg = `${emojis} ${actor} ${verb} ${target}`;

          logger.log('[RP] Sending message with attachment:', { attachment, verb, trigger });
          await context.send({
            message: msg,
            attachment
          });
          return; // обработали RP — выходим
        } catch (e) {
          logger.error('Ошибка RP-действия:', e);
        }
      }
    }

    // Проверка на блокировку чата
    if (context.text && context.text.startsWith('/') && context.peerId >= 2000000000) {
      try {
        const chatBanQuery = 'SELECT * FROM chat_bans WHERE chat_id = ?';
        const chatBanResult = await databaseQuery(chatBanQuery, [context.peerId]);
        
        if (chatBanResult && chatBanResult.length > 0) {
          const banInfo = chatBanResult[0];
          
          // Получаем информацию о сотруднике, который заблокировал
          let staffName = `[id${banInfo.banned_by}|Сотрудник]`;
          let staffAccess = 0;
          
          try {
            const { checkSysAccess, getAccessLevelName } = require('./cmds/sysadmin.js');
            staffAccess = await checkSysAccess(banInfo.banned_by);
            
            const userInfo = await vk.api.users.get({
              user_ids: banInfo.banned_by,
              fields: 'first_name,last_name'
            });
            
            if (userInfo && userInfo[0]) {
              staffName = `[id${banInfo.banned_by}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
            }
          } catch (e) {
            logger.error('Ошибка при получении информации о сотруднике:', e);
          }
          
          const { getAccessLevelName } = require('./cmds/sysadmin.js');
          const roleName = getAccessLevelName(staffAccess);
          
          // Форматируем дату
          function formatDate(dateInput) {
            let date;
            
            if (!dateInput) {
              date = new Date();
            } else if (dateInput instanceof Date) {
              date = dateInput;
            } else if (typeof dateInput === 'string') {
              // Пробуем разные варианты парсинга
              date = new Date(dateInput);
              
              // Если не получилось, пробуем заменить пробел на T
              if (isNaN(date.getTime())) {
                date = new Date(dateInput.replace(' ', 'T'));
              }
            } else if (typeof dateInput === 'number') {
              date = new Date(dateInput);
            } else {
              date = new Date();
            }
            
            const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
            const month = months[date.getMonth()];
            const day = date.getDate();
            const year = date.getFullYear();
            let hours = date.getHours();
            let minutes = date.getMinutes();
            if (minutes < 10) minutes = '0' + minutes;
            return `${day} ${month} ${year} года в ${hours}:${minutes} по GMT+3`;
          }
          
          const banDate = formatDate(banInfo.banned_at);
          
          let blockMessage = `🚫 Ваш чат заблокирован в боте.\n\n`;
          
          if (banInfo.reason && banInfo.reason !== 'Не указана') {
            blockMessage += `Причина: ${banInfo.reason}.\n`;
          } else {
            blockMessage += `Причина блокировки не указана.\n`;
          }
          
          blockMessage += `Решение принял сотрудник ${staffName} (${roleName}).\n`;
          blockMessage += `Время блокировки: ${banDate}.\n\n`;
          blockMessage += `Для разблокировки чата обратитесь к сотруднику.`;
          
          await context.reply(blockMessage);
          logger.log(`[CHAT_BAN] Попытка использования команды в заблокированном чате ${context.peerId}`);
          return;
        }
      } catch (error) {
        logger.error('Ошибка при проверке блокировки чата:', error);
      }
    }
    
    // Проверка на системный бан
    if (context.text && context.text.startsWith('/')) {
      logger.log('DEBUG: Command detected:', context.text, 'from user:', context.senderId);
      logger.log('DEBUG: Checking system ban for user:', context.senderId);
      try {
        const banInfo = await isSysBanned(context.senderId);
        logger.log('DEBUG: Ban info result:', banInfo ? 'USER IS BANNED' : 'USER NOT BANNED');
        if (banInfo) {
          logger.log('DEBUG: \u2716 BLOCKING COMMAND - User is banned');
          logger.log('DEBUG: Ban details:', JSON.stringify(banInfo, null, 2));
          let banMessage = `🚫 Доступ к командам заблокирован\n\n`;

          if (banInfo.time === 0) {
            banMessage += `⏰ Срок блокировки: навсегда\n`;
          } else {
            const banEndDate = new Date(banInfo.time * 1000);
            banMessage += `⏰ Блокировка до: ${banEndDate.toLocaleDateString()} ${banEndDate.toLocaleTimeString()}\n`;
          }

          banMessage += `📄 Причина: ${banInfo.reason}\n`;

          // Получаем информацию о том, кто заблокировал
          try {
            const adminInfo = await vk.api.users.get({ user_ids: banInfo.who });
            if (adminInfo && adminInfo[0]) {
              banMessage += `👮 Заблокировал: [id${banInfo.who}|${adminInfo[0].first_name} ${adminInfo[0].last_name}]`;
            } else {
              banMessage += `👮 Заблокировал: @id${banInfo.who} (Неизвестный администратор)`;
            }
          } catch (error) {
            banMessage += `👮 Заблокировал: @id${banInfo.who} (Неизвестный администратор)`;
          }

          context.reply(banMessage);
          return;
        }
      } catch (error) {
        logger.error('Ошибка при проверке системного бана:', error);
      }
    }

    // Проверка на payload от кнопок
    if (context.messagePayload) {
      logger.log('Получен payload от кнопок:', context.messagePayload);

      // Если это команда из настроек, передаем в обработчик команды settings
      if (context.messagePayload.command &&
        (context.messagePayload.command === 'toggle_setting' ||
          context.messagePayload.command === 'show_additional' ||
          context.messagePayload.command === 'show_main' ||
          context.messagePayload.command === 'set_cooldown' ||
          context.messagePayload.command === 'set_hello' ||
          context.messagePayload.command === 'set_rules')) {

        // Находим команду settings и выполняем ее
        for (const cmd of commands) {
          if (cmd.command === '/settings') {
            await cmd.execute(context);
            return;
          }
        }
      }
      
      // Универсальная маршрутизация payload-команд вида '/cmd'
      if (context.messagePayload && typeof context.messagePayload.command === 'string' && context.messagePayload.command.startsWith('/')) {
        const payloadCmd = context.messagePayload.command;
        for (const cmd of commands) {
          if (cmd.command === payloadCmd || (cmd.aliases && cmd.aliases.includes(payloadCmd))) {
            await cmd.execute(context);
            return;
          }
        }
      }

      // Маршрутизация callback message_event: context.eventPayload.command
      if (context.eventPayload && typeof context.eventPayload.command === 'string' && context.eventPayload.command.startsWith('/')) {
        const payloadCmd = context.eventPayload.command;
        for (const cmd of commands) {
          if (cmd.command === payloadCmd || (cmd.aliases && cmd.aliases.includes(payloadCmd))) {
            await cmd.execute(context);
            return;
          }
        }
      }
      
      // Обработка кнопок системы работ
      if (context.messagePayload.command === 'work_mine' && context.messagePayload.event_id === 9001) {
        try {
          const { getlink } = require('./util.js');
          const { Keyboard } = require('vk-io');
          
          const userName = await getlink(context.senderId);
          
          // Создаем клавиатуру с кнопками для добычи ресурсов
          const keyboard = Keyboard.builder()
            .callbackButton({
              label: '🪨 Камень (+180$)',
              payload: {
                command: 'mine_resource',
                resource: 'stone',
                event_id: 9002
              },
              color: Keyboard.SECONDARY_COLOR
            })
            .callbackButton({
              label: '⚫ Уголь (+230$)',
              payload: {
                command: 'mine_resource',
                resource: 'coal',
                event_id: 9003
              },
              color: Keyboard.SECONDARY_COLOR
            })
            .row()
            .callbackButton({
              label: '🔩 Железо (+350$)',
              payload: {
                command: 'mine_resource',
                resource: 'iron',
                event_id: 9004
              },
              color: Keyboard.PRIMARY_COLOR
            })
            .callbackButton({
              label: '🟡 Золото (+500$)',
              payload: {
                command: 'mine_resource',
                resource: 'gold',
                event_id: 9005
              },
              color: Keyboard.PRIMARY_COLOR
            })
            .row()
            .callbackButton({
              label: '💎 Алмаз (+1000$)',
              payload: {
                command: 'mine_resource',
                resource: 'diamond',
                event_id: 9006
              },
              color: Keyboard.POSITIVE_COLOR
            })
            .inline();
          
          const message = `⛏️ Шахта

👤 ${userName} устроился на работу в шахту!

💰 Добывайте ресурсы и зарабатывайте:
🪨 Камень — 180$ за клик
⚫ Уголь — 230$ за клик
🔩 Железо — 350$ за клик
🟡 Золото — 500$ за клик
💎 Алмаз — 1000$ за клик

💡 Нажимайте на кнопки для добычи ресурсов!`;
          
          await context.send({
            message: message,
            keyboard: keyboard
          });
          
          return;
        } catch (error) {
          logger.error('Ошибка при обработке кнопки шахты:', error);
          await context.reply('❌ Произошла ошибка при устройстве на работу.');
          return;
        }
      }
      
      // Обработка кнопок добычи ресурсов
      if (context.messagePayload.command === 'mine_resource' && 
          [9002, 9003, 9004, 9005, 9006].includes(context.messagePayload.event_id)) {
        try {
          const { updateUserResources, getUserResources } = require('./filedb.js');
          const { getlink } = require('./util.js');
          
          const resourceType = context.messagePayload.resource;
          const userName = await getlink(context.senderId);
          
          // Добавляем 1 единицу ресурса
          const updateResult = await updateUserResources(context.senderId, resourceType, 1);
          
          if (!updateResult) {
            await context.reply('❌ Произошла ошибка при добыче ресурса.');
            return;
          }
          
          // Получаем обновленные ресурсы
          const resources = await getUserResources(context.senderId);
          
          // Названия и стоимость ресурсов
          const resourceInfo = {
            stone: { name: '🪨 Камень', value: 180 },
            coal: { name: '⚫ Уголь', value: 230 },
            iron: { name: '🔩 Железо', value: 350 },
            gold: { name: '🟡 Золото', value: 500 },
            diamond: { name: '💎 Алмаз', value: 1000 }
          };
          
          const resource = resourceInfo[resourceType];
          const totalAmount = resources[resourceType];
          
          const message = `✅ Добыча успешна!

👤 ${userName}

⛏️ Добыто: ${resource.name} (+1 шт.)
💰 Стоимость: ${resource.value}$
📦 Всего ${resource.name.toLowerCase()}: ${totalAmount} шт.

💡 Используйте /обменник для продажи ресурсов!`;
          
          await context.reply(message);
          return;
        } catch (error) {
          logger.error('Ошибка при добыче ресурса:', error);
          await context.reply('❌ Произошла ошибка при добыче ресурса.');
          return;
        }
      }
      
      // Обработка кнопок игры в слова
      if (context.messagePayload.action &&
        (context.messagePayload.action === 'join_game' ||
          context.messagePayload.action === 'leave_game' ||
          context.messagePayload.action === 'stop_game' ||
          context.messagePayload.action === 'show_rules' ||
          context.messagePayload.action === 'start_new_game')) {
        
        try {
          const wordsModule = require('./cmds/words.js');
          await handleWordsCallback(context, context.messagePayload, wordsModule);
          return;
        } catch (error) {
          logger.error('Ошибка при обработке callback игры в слова:', error);
          await context.reply('❌ Произошла ошибка при обработке игры в слова.');
          return;
        }
      }
    }

    // ОПТИМИЗАЦИЯ: Проверка на спам с кэшированием
    try {
      const settings = await getChatSettingsOptimized(context.peerId);

      if (settings && settings.spam === 1 && context.senderId > 0) {
        const userRole = await getUserRole(context.peerId, context.senderId);

        if (userRole < 20) { // Не проверяем модераторов и выше
          const isSpamming = checkSpam(context.senderId, context.peerId, context.text);

          if (isSpamming) {
            try {
              // Получаем информацию о пользователе
              const userInfo = await vk.api.users.get({ user_ids: [context.senderId] });
              const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'пользователя';

              // Мутим пользователя на 5 минут
              const memberIds = [context.senderId];
              const muteMinutes = 5 * 60; // 5 минут

              await vk.api.messages.delete({
                delete_for_all: 1,
                peer_id: context.peerId,
                cmids: context.conversationMessageId,
              });

              await vk.api.messages.changeConversationMemberRestrictions({
                peer_id: context.peerId,
                member_ids: memberIds,
                for: muteMinutes,
                action: "ro",
              });

              context.send({
                message: `🔇 [id${context.senderId}|${userName}] получил мут на 5 минут за спам!\n\n📝 Анти-спам систему можно отключить командой: /settings spam 0`,
              });

              return;
            } catch (error) {
              logger.error('Ошибка при выдаче мута за спам:', error);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Ошибка при проверке настроек анти-спама:', error);
    }
  } catch (error) {
    logger.error('Ошибка при обработке сообщения:', error);
    // 🚀 ОПТИМИЗАЦИЯ: Записываем ошибку в мониторинг
    performanceMonitor.recordError(error, {
      peerId: context.peerId,
      senderId: context.senderId
    });
  } finally {
    // 🚀 ОПТИМИЗАЦИЯ: Завершаем замер времени
    performanceMonitor.endTimer(timerId);
  }

  const { text } = context.message;
  const { senderId, peerId, payload } = context;
  const parts = text.split(" ");
  const userId = senderId;
  // Проверяем режим тишины - если включен, то обычные участники не могут отправлять сообщения
  // (системный мут уже установлен через VK API, поэтому дополнительная логика не нужна)
  if (silenceConf[peerId] && silenceConf[peerId].silence === 1) {
    try {
      let userRole = await getUserRole(context.peerId, context.senderId);
      if (userRole <= 20) {
        // Разрешаем выполнение команд администраторам даже в режиме тишины
        for (const cmd of commands) {
          if (
            parts[0] === cmd.command ||
            (cmd.aliases && cmd.aliases.includes(parts[0]))
          ) {
            await cmd.execute(context);
            return;
          }
        }
        // Обычные участники не могут отправлять сообщения в режиме тишины
        // (системный мут VK API автоматически блокирует их сообщения)
        return;
      }
    } catch (error) {
      logger.error("Ошибка при получении роли пользователя:", error);
    }
  }

  const getLinksQuery = `
  SELECT *
  FROM conference
  WHERE conference_id = ?
`;

  // 🚀 ОПТИМИЗАЦИЯ: Проверяем настройки ссылок с кэшированием


  const getConferenceCooldown = async (peerId) => {
    try {
      const settings = await getChatSettingsOptimized(peerId);
      const cooldown = settings && settings.cooldown ? parseInt(settings.cooldown) : 0;
      return cooldown;
    } catch (error) {
      logger.error("Ошибка при получении cooldown из файла:", error);
      return 0;
    }
  };

  const cooldown = await getConferenceCooldown(context.peerId);

  if (cooldown > 0) {
    const userRole = await getUserRole(context.peerId, context.senderId);
    if (userRole < 20) {
      const memberIds = [context.senderId];
      const muteMinutes = cooldown;

      try {
        await vk.api.messages.changeConversationMemberRestrictions({
          peer_id: context.peerId,
          member_ids: memberIds,
          for: muteMinutes,
          action: "ro",
        });
      } catch (error) {
        logger.error("Ошибка при установке КД:", error);
      }
    }
  }

  const checkAttachmentPermissions = (
    context,
    attachmentType,
    permissionMessage
  ) => {
    return new Promise(async (resolve, reject) => {
      let attachs = attachmentType;

      if (attachmentType === "stickers") {
        attachs = "sticker";
      } else if (attachmentType === "docs") {
        attachs = "doc";
      } else if (attachmentType === "images") {
        attachs = "photo";
      } else if (attachmentType === "video") {
        attachs = "video";
      } else if (attachmentType === "reposts") {
        attachs = "wall";
      }

      // 🚀 ОПТИМИЗАЦИЯ: Кэшированная загрузка настроек
      try {
        const settings = await getChatSettingsOptimized(context.peerId);

        if (!settings) {
          resolve();
          return;
        }

        if (settings && settings[attachmentType] === 1 && context.attachments && context.attachments.length > 0) {
          const attachmentTypes = context.attachments.map(
            (attachment) => attachment.type
          );

          if (attachmentTypes.includes(attachs)) {
            try {
              const userRole = await getUserRole(context.peerId, context.senderId);
              
              if (userRole < 20) {
                try {
                  // Получаем информацию о пользователе
                  const userInfo = await vk.api.users.get({ user_ids: [context.senderId] });
                  const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'пользователя';

                  await vk.api.messages.delete({
                    delete_for_all: 1,
                    peer_id: context.peerId,
                    cmids: context.conversationMessageId,
                  });

                  // Отправляем сообщение с информацией о запрете
                  let settingName = '';
                  let settingCommand = '';

                  switch (attachmentType) {
                    case 'stickers':
                      settingName = 'стикеров';
                      settingCommand = 'stickers';
                      break;
                    case 'docs':
                      settingName = 'документов';
                      settingCommand = 'docs';
                      break;
                    case 'reposts':
                      settingName = 'репостов';
                      settingCommand = 'reposts';
                      break;
                    case 'images':
                      settingName = 'изображений';
                      settingCommand = 'images';
                      break;
                    case 'video':
                      settingName = 'видео';
                      settingCommand = 'video';
                      break;
                    default:
                      settingName = 'контента';
                      settingCommand = attachmentType;
                  }

                  context.send({
                    message: `⛔ Сообщение [id${context.senderId}|${userName}] было удалено, поскольку в нём ${getContentDescription(attachmentType)}.\n\n📝 Эту настройку можно отключить командой: /settings ${settingCommand} 0`,
                  });
                } catch (error) {
                  logger.error(`Ошибка при удалении сообщения с ${attachmentType}:`, error);

                  try {
                    await vk.api.messages.delete({
                      delete_for_all: 1,
                      peer_id: context.peerId,
                      cmids: context.conversationMessageId,
                    });
                  } catch (deleteError) {
                    logger.error('Ошибка при удалении сообщения:', deleteError);
                  }
                }
              }
            } catch (err) {
              logger.error('Ошибка при получении роли пользователя:', err);
            }
            resolve();
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      } catch (error) {
        logger.error(`Ошибка при проверке разрешений для вложений типа ${attachmentType}:`, error);
        resolve();
      }
    });
  };

  await checkAttachmentPermissions(
    context,
    "stickers",
    "❌ В данном чате запрещено отправлять стикеры."
  );
  await checkAttachmentPermissions(
    context,
    "docs",
    "❌ В данном чате запрещено отправлять документы."
  );
  await checkAttachmentPermissions(
    context,
    "images",
    "❌ В данном чате запрещено отправлять фотографии."
  );
  await checkAttachmentPermissions(
    context,
    "video",
    "❌ В данном чате запрещено отправлять видео."
  );
  await checkAttachmentPermissions(
    context,
    "reposts",
    "❌ В данном чате запрещено отправлять репосты."
  );

  // Проверка на запрещенные ссылки
  if (context.text && context.senderId > 0) {
    try {
      const settings = await getChatSettingsOptimized(context.peerId);
      
      if (settings && settings.links === 1) {
        const userRole = await getUserRole(context.peerId, context.senderId);
        
        if (userRole < 20) { // Не проверяем модераторов и выше
          const detectedLinks = detectLinks(context.text);
          
          if (detectedLinks.length > 0) {
            try {
              // Получаем информацию о пользователе
              const userInfo = await vk.api.users.get({ user_ids: [context.senderId] });
              const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'пользователя';

              // Удаляем сообщение
              await vk.api.messages.delete({
                delete_for_all: 1,
                peer_id: context.peerId,
                cmids: context.conversationMessageId,
              });

              // Создаем кнопку "Посмотреть" с информацией о нарушении
              const { Keyboard } = require('vk-io');
              
              const viewButton = Keyboard.builder()
                .callbackButton({
                  label: 'Посмотреть',
                  payload: {
                    command: 'view_link_violation',
                    user_id: context.senderId,
                    user_name: userName,
                    links: detectedLinks.map(link => link.url),
                    time: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
                    peer_id: context.peerId
                  },
                  color: Keyboard.NEGATIVE_COLOR
                })
                .inline();

              // Отправляем сообщение с кнопкой
              await context.send({
                message: `⛔ Сообщение [id${context.senderId}|${userName}] было удалено, поскольку в нём была ссылка.\n\n📝 Эту настройку можно отключить командой: /settings links 0`,
                keyboard: viewButton
              });

              // Прерываем дальнейшую обработку сообщения
              return;
            } catch (error) {
              logger.error('Ошибка при удалении сообщения со ссылкой:', error);
              return; // Прерываем обработку даже при ошибке
            }
          }
        }
      }
    } catch (error) {
      logger.error('Ошибка при проверке настроек ссылок:', error);
    }
  }

  const conversationId = peerId;


  if (userId > 0) {

    const selectUserQuery = `
    SELECT messages_count
    FROM conference_${conversationId}
    WHERE user_id = ?
  `;

    database.query(selectUserQuery, [userId], async (error, results) => {
      if (error) {
        return;
      }

      if (results.length === 0) {

        const insertUserQuery = `
        INSERT INTO conference_${conversationId} (user_id, messages_count, coins)
        VALUES (?, 1, 1)
      `;

        database.query(
          insertUserQuery,
          [userId],
          (insertError, insertResult) => {
            if (insertError) {
              logger.error("Ошибка при добавлении пользователя:", insertError);
              return context.send("❌ Произошла ошибка.");
            }
          }
        );
      } else {

        const currentMessageCount = results[0].messages_count;
        const updatedMessageCount = currentMessageCount + 1;

        const updateMessageCountQuery = `
        UPDATE conference_${conversationId}
        SET messages_count = ?
        WHERE user_id = ?
      `;

        database.query(
          updateMessageCountQuery,
          [updatedMessageCount, userId],
          (updateError, updateResult) => {
            if (updateError) {
              logger.error(
                "Ошибка при обновлении количества сообщений:",
                updateError
              );
              return context.send("❌ Произошла ошибка.");
            }
          }
        );
      }
    });
  } else {
    return;
  }
  // Обработка кнопки "Активировать"
  if (context.messagePayload) {
    try {
      const payload = typeof context.messagePayload === 'string'
        ? JSON.parse(context.messagePayload)
        : context.messagePayload;

      if (payload.button === "start" && payload.event_id === 51898) {
        logger.log('Обработка кнопки активации:', payload);
        await handleStartButton(context);
        return;
      }
    } catch (error) {
      logger.error('Ошибка при парсинге payload:', error);
    }
  }
  // Обработка сообщений для игры в слова
  if (context.text && !context.text.startsWith('/') && peerId >= 2000000000) {
    try {
      const wordsModule = require('./cmds/words.js');
      const gameState = wordsModule.activeGames.get(peerId);
      
      if (gameState && gameState.status === 'playing' && gameState.currentPlayer === context.senderId) {
        const word = context.text.trim();
        const validation = wordsModule.validateWord(word, gameState);
        
        if (!validation.valid) {
          await context.reply(validation.error);
          return;
        }
        
        // Слово валидно, обрабатываем ход
        gameState.usedWords.add(word.toLowerCase());
        gameState.wordCount++;
        gameState.lastLetter = wordsModule.getLastLetter(word);
        
        // Очищаем таймер
        if (gameState.timeoutId) {
          clearTimeout(gameState.timeoutId);
        }
        
        // Переходим к следующему игроку
        const currentPlayerIndex = gameState.players.indexOf(gameState.currentPlayer);
        const nextPlayerIndex = (currentPlayerIndex + 1) % gameState.players.length;
        gameState.currentPlayer = gameState.players[nextPlayerIndex];
        
        const currentPlayerName = await wordsModule.getUserName(context.senderId);
        const nextPlayerName = await wordsModule.getUserName(gameState.currentPlayer);
        
        const message = `✅ ${currentPlayerName} сказал слово: «${word}»\n\n💬 ${nextPlayerName} говорит слово на «${gameState.lastLetter.toUpperCase()}». У него 60 секунд.`;
        
        await context.send({
          message: message,
          keyboard: wordsModule.createGameKeyboard(gameState)
        });
        
        // Запускаем новый таймер
        startPlayerTimeout(gameState, peerId, wordsModule);
        
        return;
      }
    } catch (error) {
      logger.error('Ошибка при обработке игры в слова:', error);
    }
  }

  // Проверка на слова "команды" или "Команды"
  if (text && (text.toLowerCase() === 'команды' || text === 'Команды')) {
    await context.send({
      message: '⚙️ Полный список команд доступен по ссылке:\n🔗 vk.com/@managerblu-list-of-commands'
    });
    return;
  }

  try {
    // 🔒 ГЛОБАЛЬНАЯ ПРОВЕРКА: Команды работают ТОЛЬКО в беседах!
    if (peerId < 2000000000) {
      return; // Игнорируем все команды в личных сообщениях
    }
    
    let found = false;
    for (const cmd of commands) {
      if (
        parts[0] === cmd.command ||
        (cmd.aliases && cmd.aliases.includes(parts[0]))
      ) {
        await cmd.execute(context);
        found = true;
        return;
      }
    }
    // Если не нашли команду и это /команда
    if (!found && parts[0].startsWith('/')) {
      const inputCmd = parts[0].toLowerCase();
      const allCmds = [];
      for (const cmd of commands) {
        if (cmd.command) allCmds.push(cmd.command);
        if (cmd.aliases) allCmds.push(...cmd.aliases);
      }
      const uniqueCmds = [...new Set(allCmds)];
      function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[b.length][a.length];
      }
      let similar = [];
      const query = inputCmd.replace('/', '');
      if (query.length >= 1) {
        const substringMatches = uniqueCmds.filter(cmd => cmd.toLowerCase().includes(query));
        if (substringMatches.length) {
          similar = substringMatches.slice(0, 10);
        }
      }
      if (!similar.length) {
        const scored = uniqueCmds.map(cmd => ({
          cmd,
          lev: levenshtein(cmd.toLowerCase(), inputCmd)
        }));
        scored.sort((a, b) => a.lev - b.lev);
        similar = scored.filter(s => s.lev <= 3).map(s => s.cmd).slice(0, 10);
      }
      let suggest = similar.length ? `Возможно, вы имели в виду: ${similar.join(', ')}` : '';
      let msg = `🤔 Команда "${inputCmd}" не найдена.${suggest ? '\n' + suggest : ''}`;
      context.send(msg);
      return;
    }
  } catch (error) {
    logger.error("Произошла ошибка:", error);
  } finally {
    await next();
  }

  // === Обработка ответов на предложение о браке ===
  const marriageText = context.text && context.text.trim().toLowerCase();
  if (marriageText === 'принять' || marriageText === 'отказать') {
    const fs = require('fs');
    const path = require('path');
    const chat_id = context.peerId;
    const user_id = context.senderId;
    const offersFile = path.join(__dirname, 'data', `marriage_offers_${chat_id}.json`);
    const marriagesFile = path.join(__dirname, 'data', `marriages_${chat_id}.json`);
    let offers = [];
    let marriages = [];
    try {
      if (fs.existsSync(offersFile)) {
        offers = JSON.parse(fs.readFileSync(offersFile, 'utf8'));
      }
    } catch (e) { offers = []; }
    try {
      if (fs.existsSync(marriagesFile)) {
        marriages = JSON.parse(fs.readFileSync(marriagesFile, 'utf8'));
      }
    } catch (e) { marriages = []; }
    // Ищем предложение на этого пользователя
    const offerIdx = offers.findIndex(o => o.to_id === user_id);
    if (offerIdx === -1) return;
    const offer = offers[offerIdx];
    if (marriageText === 'принять') {
      // Получаем имена через VK API
      let fromName = `[id${offer.from_id}|Пользователь]`;
      let toName = `[id${offer.to_id}|Пользователь]`;
      try {
        const users = await vk.api.users.get({ user_ids: `${offer.from_id},${offer.to_id}` });
        if (users && users.length === 2) {
          fromName = `[id${offer.from_id}|${users[0].first_name} ${users[0].last_name}]`;
          toName = `[id${offer.to_id}|${users[1].first_name} ${users[1].last_name}]`;
        }
      } catch (e) { }
      marriages.push({ user1: offer.from_id, user2: offer.to_id, date: Date.now() });
      fs.writeFileSync(marriagesFile, JSON.stringify(marriages, null, 2));
      offers.splice(offerIdx, 1);
      fs.writeFileSync(offersFile, JSON.stringify(offers, null, 2));
      context.reply(`💞 Поздравляем! ${toName} принял(-а) предложение о браке от ${fromName}! Теперь вы официально в браке!`);
    } else {
      // отказ
      offers.splice(offerIdx, 1);
      fs.writeFileSync(offersFile, JSON.stringify(offers, null, 2));
      context.reply('❌ Предложение о браке отклонено.');
    }
    return;
  }
});

function generateUniqueKey() {
  const keyLength = 5;
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";

  for (let i = 0; i < keyLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters.charAt(randomIndex);
  }

  return key;
}

vk.updates.on("message_event", async (context) => {

  // Safe log to avoid circular JSON crash
  try {
    logger.log('message_event ctx', {
      eventId: context.eventId || context.event_id,
      userId: context.userId,
      peerId: context.peerId
    });
  } catch (_) {}


  let eventPayload;
  if (context.eventPayload) {
    // Проверяем, является ли eventPayload уже объектом или строкой
    if (typeof context.eventPayload === 'string') {
      try {
        eventPayload = JSON.parse(context.eventPayload);
      } catch (e) {
        logger.error('Ошибка парсинга eventPayload:', e);
        eventPayload = context.eventPayload;
      }
    } else {
      eventPayload = context.eventPayload;
    }
  } else if (context.payload) {
    eventPayload = context.payload;
  } else if (context.object && context.object.payload) {
    eventPayload = context.object.payload;
  }

  logger.log('=== EVENT PAYLOAD ===');
  logger.log(eventPayload);

  // [reverted] no immediate ACK here

  // [reverted] no legacy payload normalization

  // [reverted] no universal routing in message_event


  // Обработка кнопок режима тишины
  if (eventPayload && eventPayload.action === 'silence_mode') {
    logger.log('[SILENCE] Callback получен:', eventPayload);
    const { mode, peerId, adminId } = eventPayload;
    
    // Проверяем, что кнопку нажал тот, кто вызвал команду
    if (context.userId !== adminId) {
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: context.event_id,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Только администратор может управлять режимом тишины!'
          })
        });
      } catch (e) {
        logger.error('[SILENCE] Ошибка ответа на callback:', e);
      }
      return;
    }
    
    try {
      const silenceModule = require('./cmds/silence.js');
      let result;
      
      logger.log('[SILENCE] Выполняем действие:', mode);
      
      if (mode === 'delete') {
        result = await silenceModule.activateDeleteMode(peerId, adminId);
      } else if (mode === 'mute') {
        result = await silenceModule.activateMuteMode(peerId, adminId);
      } else if (mode === 'deactivate') {
        result = await silenceModule.deactivateSilenceMode(peerId, adminId);
      }
      
      logger.log('[SILENCE] Результат:', result);
      
      if (result) {
        // Отправляем результат в чат
        await vk.api.messages.send({
          peer_id: peerId,
          message: result.message,
          random_id: Math.floor(Math.random() * 1000000000)
        });
        
        logger.log('[SILENCE] Сообщение отправлено в чат');
        
        // Отвечаем на callback
        const eventId = context.event_id;
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: result.success ? '✅ Режим активирован' : '❌ Ошибка'
          })
        });
        
        logger.log('[SILENCE] Callback обработан успешно');
      }
    } catch (error) {
      logger.error('[SILENCE] Ошибка при обработке режима тишины:', error);
      
      // Отвечаем на callback с ошибкой
      try {
        const eventId = context.event_id;
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: `❌ Ошибка: ${error.message || 'Неизвестная ошибка'}`
          })
        });
      } catch (answerError) {
        logger.error('[SILENCE] Ошибка при отправке ответа на callback:', answerError);
      }
    }
    return;
  }
  
  // Обработка пагинации sysinfo
  if (eventPayload && eventPayload.action === 'sysinfo_page') {
    try {
      const sysinfoCommand = commands.find(cmd => cmd.command === '/sysinfo');
      if (sysinfoCommand && sysinfoCommand.handleCallback) {
        await sysinfoCommand.handleCallback(context, eventPayload);
        
        // Отвечаем на callback
        try {
          await vk.api.messages.sendMessageEventAnswer({
            event_id: context.event_id,
            user_id: context.userId,
            peer_id: context.peerId
          });
        } catch (e) {}
      }
    } catch (error) {
      logger.error('Ошибка при обработке sysinfo пагинации:', error);
    }
    return;
  }
  
  // Обработка пагинации checkchats
  if (eventPayload && eventPayload.action === 'checkchats_page') {
    try {
      const checkchatsCommand = commands.find(cmd => cmd.command === '/checkchats');
      if (checkchatsCommand && checkchatsCommand.handleCallback) {
        await checkchatsCommand.handleCallback(context, eventPayload);
        
        // Отвечаем на callback
        try {
          await vk.api.messages.sendMessageEventAnswer({
            event_id: context.event_id,
            user_id: context.userId,
            peer_id: context.peerId
          });
        } catch (e) {}
      }
    } catch (error) {
      logger.error('Ошибка при обработке checkchats пагинации:', error);
    }
    return;
  }

  logger.log('=== ВСЕ ВОЗМОЖНЫЕ EVENT_ID ===');
  logger.log({
    'context.eventId': context.eventId,
    'context.event_id': context.event_id,
    'context.object?.event_id': context.object && context.object.event_id,
    'top level event_id': context.event_id
  });


  const event_id = context.event_id;

  logger.log('=== ИСПОЛЬЗУЕМЫЙ EVENT_ID ===');
  logger.log(event_id);

  const selectNicknameQuery = `
    SELECT agent_access FROM agents
    WHERE user_id = ?
  `;

  const SelectPizdecQuery = `
    SELECT blocked_users FROM conference_${context.peerId}
    WHERE user_id = ?
  `;


  if (eventPayload && eventPayload.command === 'settings_toggle') {
    try {
      const { setting, value } = eventPayload;


      const userId = context.userId || (context.object && context.object.user_id);
      const peerId = context.peerId || (context.object && context.object.peer_id);
      const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);

      logger.log('=== USER ID, PEER ID, MESSAGE ID ===');
      logger.log({ userId, peerId, conversationMessageId });


      const userRole = await getUserRole(peerId, userId);
      if (userRole < 80) {

        try {

          const eventId = context.event_id;

          logger.log('Используем следующие данные для уведомления о правах:');
          logger.log({
            event_id: eventId,
            user_id: userId,
            peer_id: peerId
          });

          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: userId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ У вас недостаточно прав для изменения настроек'
            })
          });
          return true;
        } catch (error) {
          logger.error('Ошибка при отправке ответа на callback:', error);
          return false;
        }
      }


      const updateQuery = `
        UPDATE conference
        SET ${setting} = ?
        WHERE conference_id = ?
      `;

      await queryAsync(updateQuery, [value, peerId]);


      const getSettingsQuery = `
        SELECT *
        FROM conference
        WHERE conference_id = ?
      `;

      const results = await queryAsync(getSettingsQuery, [peerId]);
      if (!results || results.length === 0) {
        throw new Error('Настройки беседы не найдены');
      }

      const settings = results[0];



      const settingsModule = require('./cmds/settings.js');
      const keyboard = settingsModule.getSettingsKeyboard(settings);
      const messageText = settingsModule.getSettingsMessageText(settings) +
        `\n\n🔄 Настройки изменены пользователем [id${userId}|@id${userId}]`;


      await vk.api.messages.edit({
        peer_id: peerId,
        conversation_message_id: conversationMessageId,
        message: messageText,
        keyboard: keyboard
      });


      try {
        logger.log('=== ОТПРАВКА ОТВЕТА НА CALLBACK ===');


        const userId = context.userId || (context.object && context.object.user_id);
        const peerId = context.peerId || (context.object && context.object.peer_id);
        const eventId = context.event_id;

        logger.log('Используем следующие данные для ответа:');
        logger.log({
          event_id: eventId,
          user_id: userId,
          peer_id: peerId
        });


        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: userId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: `✅ Настройка "${setting}" успешно изменена`
          })
        });

        logger.log('=== ОТВЕТ НА CALLBACK УСПЕШНО ОТПРАВЛЕН ===');
        return true;
      } catch (error) {
        logger.error('Ошибка при отправке ответа на callback:', error);
        return false;
      }
    } catch (error) {
      logger.error('Ошибка при обработке settings_toggle:', error);


      const userId = context.userId || (context.object && context.object.user_id);
      const peerId = context.peerId || (context.object && context.object.peer_id);


      try {

        const eventId = context.event_id;

        logger.log('Используем следующие данные для уведомления об ошибке:');
        logger.log({
          event_id: eventId,
          user_id: userId,
          peer_id: peerId
        });

        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: userId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при изменении настройки'
          })
        });
        return true;
      } catch (error) {
        logger.error('Ошибка при отправке ответа на callback:', error);
        return false;
      }
    }
  }

  // Обработка отмены снятия роли из /rr (inline callback)
  if (eventPayload && eventPayload.command === '/rr' && eventPayload.action === 'cancel') {
    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    // Немедленный ACK, чтобы остановить спиннер
    try {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({ type: 'show_snackbar', text: '⏳ Выполняю отмену...' })
      });
    } catch (e) {
      console.warn('ACK rr cancel warn:', e?.message || e);
    }

    // Делегируем обработку в команду /rr
    try {
      const rrCmd = (global.commands || []).find(c => c && c.command === '/rr' && typeof c.execute === 'function');
      if (rrCmd) {
        const rnd = () => Math.floor(Math.random() * 1e9);
        const fakeContext = {
          peerId,
          userId: actorId,
          eventId,
          eventPayload,
          // Унифицированные отправители, совместимые с rr.js
          send: ({ message, keyboard, disable_mentions }) => vk.api.messages.send({ peer_id: peerId, message, keyboard, disable_mentions, random_id: rnd() }),
          reply: (data) => {
            if (typeof data === 'string') {
              return vk.api.messages.send({ peer_id: peerId, message: data, random_id: rnd() });
            }
            const { message, keyboard, disable_mentions } = data || {};
            return vk.api.messages.send({ peer_id: peerId, message, keyboard, disable_mentions, random_id: rnd() });
          }
        };
        await rrCmd.execute(fakeContext);
      }
    } catch (e) {
      logger.error('Ошибка делегирования rr cancel:', e);
    }
    return;
  }

  // Обработка нажатия кнопки "Получить бонус"
  if (eventPayload && eventPayload.command === 'get_bonus') {
    const { handleDaily } = require('./cmds/daily.js');
    const bonusReminder = global.vk && global.vk.bonusReminder;

    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    const lockKey = `${actorId}`; // пер-пользовательская блокировка
    if (processingBonuses.has(lockKey)) {
      // Уже обрабатывается — показываем снэкбар и выходим
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({ type: 'show_snackbar', text: '⏳ Запрос обрабатывается...' })
        });
      } catch (_) {}
      return;
    }

    processingBonuses.add(lockKey);
    try {
      const result = await handleDaily(actorId, peerId, bonusReminder);

      // Сообщение в чат с результатом
      await vk.api.messages.send({
        peer_id: peerId,
        message: result.message,
        random_id: Math.floor(Math.random() * 1000000000)
      });

      // Ответ на callback с снэкбаром
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: result.success ? '✅ Бонус выдан!' : '⏰ Ещё рано. Попробуйте позже'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback (get_bonus):', answerError);
      }

      return;
    } catch (error) {
      logger.error('Ошибка при обработке get_bonus:', error);
    } finally {
      // Снимаем блокировку через короткую паузу, чтобы поймать даблклик
      setTimeout(() => processingBonuses.delete(lockKey), 1500);
    }
  }

  async function updateAgentAccess(eventPayload, accessLevel, message, context) {
    if (!Config.developers.includes(context.userId)) return;

    const selectResults = await databaseQuery(selectNicknameQuery, eventPayload.button);

    const updateNicknameQuery = `
      UPDATE agents
      SET agent_access = ?
      WHERE user_id = ?
    `;

    const insertNicknameQuery = `
      INSERT INTO agents (agent_access, user_id)
      VALUES (?, ?)
    `;

    try {
      if (selectResults.length > 0) {
        await databaseQuery(updateNicknameQuery, [accessLevel, eventPayload.button]);
      } else {
        await databaseQuery(insertNicknameQuery, [accessLevel, eventPayload.button]);
      }

      await vk.api.messages.send({
        peer_id: context.peerId,
        message: message,
        random_id: generateRandom32BitNumber(),
      });

      await vk.api.messages.delete({
        peer_id: context.peerId,
        delete_for_all: 1,
        cmids: context.conversationMessageId,
      });
    } catch (error) {
      logger.error('Произошла ошибка:', error);
      await context.send('❌ Произошла ошибка.');
    }
  }

  if (eventPayload.event_id === 8888) {
    updateAgentAccess(eventPayload, 2, `⭐ [id${eventPayload.button}|Пользователь] получил группу «Менеджер»`, context);
  } else if (eventPayload.event_id === 8887) {
    updateAgentAccess(eventPayload, 1, `⭐ [id${eventPayload.button}|Пользователь] получил группу «Тех. поддержка»`, context);
  } else if (eventPayload.event_id === 8886) {
    updateAgentAccess(eventPayload, 3, `⭐ [id${eventPayload.button}|Пользователь] получил группу «Администратор»`, context);
  } else if (eventPayload.event_id === 8885) {
    updateAgentAccess(eventPayload, 4, `⭐ [id${eventPayload.button}|Пользователь] получил группу «Разработчик»`, context);
  } else if (eventPayload.event_id === 5512) {
    try {
      await vk.api.messages.delete({
        peer_id: context.peerId,
        delete_for_all: 1,
        cmids: context.conversationMessageId,
      });
    } catch (error) {
      logger.error("Error deleting message:", error);
    }
  } else if (eventPayload.event_id === 9001 && eventPayload.command === 'work_mine') {
    // Обработка кнопки "Шахта"
    try {
      const { getlink } = require('./util.js');
      const { Keyboard } = require('vk-io');
      const { hireWorker } = require('./workManager.js');
      
      const userName = await getlink(context.userId);
      
      // Устраиваем пользователя на работу в шахту
      const isNewWorker = hireWorker(context.userId, context.peerId);
      
      // Создаем клавиатуру с кнопками для добычи ресурсов
      const keyboard = Keyboard.builder()
        .callbackButton({
          label: '🪨 Камень (+180$)',
          payload: {
            command: 'mine_resource',
            resource: 'stone',
            event_id: 9002
          },
          color: Keyboard.PRIMARY_COLOR
        })
        .callbackButton({
          label: '⚫ Уголь (+230$)',
          payload: {
            command: 'mine_resource',
            resource: 'coal',
            event_id: 9003
          },
          color: Keyboard.PRIMARY_COLOR
        })
        .row()
        .callbackButton({
          label: '🔩 Железо (+350$)',
          payload: {
            command: 'mine_resource',
            resource: 'iron',
            event_id: 9004
          },
          color: Keyboard.PRIMARY_COLOR
        })
        .callbackButton({
          label: '🟡 Золото (+500$)',
          payload: {
            command: 'mine_resource',
            resource: 'gold',
            event_id: 9005
          },
          color: Keyboard.PRIMARY_COLOR
        })
        .row()
        .callbackButton({
          label: '💎 Алмаз (+1000$)',
          payload: {
            command: 'mine_resource',
            resource: 'diamond',
            event_id: 9006
          },
          color: Keyboard.POSITIVE_COLOR
        })
        .inline();
      
      // Убираем отправку сообщения в чат - показываем только кнопки через редактирование исходного сообщения
      await vk.api.messages.edit({
        peer_id: context.peerId,
        conversation_message_id: context.conversationMessageId,
        message: `👤 ${userName} устроился на работу в шахту`,
        keyboard: keyboard
      });
      
      // Отвечаем на callback
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Устроился на работу в шахту!'
        })
      });
      
    } catch (error) {
      logger.error('Ошибка при обработке кнопки шахты:', error);
      
      try {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при устройстве на работу'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
  } else if (eventPayload.event_id === 9007 && eventPayload.command === 'work_pilot') {
    // Обработка кнопки "Лётчик"
    try {
      const { getlink } = require('./util.js');
      const { Keyboard } = require('vk-io');
      const { hirePilot, getAircraftTypes } = require('./pilotManager.js');
      
      const userName = await getlink(context.userId);
      
      // Устраиваем пользователя на работу лётчиком
      const isNewPilot = hirePilot(context.userId, context.peerId);
      
      // Получаем список самолётов
      const aircraftTypes = getAircraftTypes();
      
      // Создаём клавиатуру с самолётами
      const keyboard = Keyboard.builder();
      
      aircraftTypes.forEach((aircraft, index) => {
        if (index % 2 === 0 && index > 0) {
          keyboard.row();
        }
        keyboard.callbackButton({
          label: aircraft.name,
          payload: {
            command: 'select_aircraft',
            aircraft_id: aircraft.id,
            event_id: 9008 + index
          },
          color: Keyboard.PRIMARY_COLOR
        });
      });
      
      keyboard.inline();
      
      // Редактируем сообщение с выбором самолёта
      await vk.api.messages.edit({
        peer_id: context.peerId,
        conversation_message_id: context.conversationMessageId,
        message: `👤 ${userName} устроился лётчиком\n\n✈️ Выберите самолёт для рейса:`,
        keyboard: keyboard
      });
      
      // Отвечаем на callback
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Устроился лётчиком!'
        })
      });
      
    } catch (error) {
      logger.error('Ошибка при обработке кнопки лётчик:', error);
      
      try {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при устройстве лётчиком'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
  } else if ([9008, 9009, 9010, 9011, 9012, 9013].includes(eventPayload.event_id) && eventPayload.command === 'select_aircraft') {
    // Обработка выбора самолёта
    try {
      const { isPilot, startFlight, getRandomDestination } = require('./pilotManager.js');
      const { getlink } = require('./util.js');
      
      // Проверяем, что пользователь устроился лётчиком
      if (!isPilot(context.userId)) {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Сначала устройтесь лётчиком!'
          })
        });
        return;
      }
      
      const aircraftId = eventPayload.aircraft_id;
      const destination = getRandomDestination();
      
      // Начинаем полёт
      const flight = startFlight(context.userId, aircraftId, destination.city);
      
      if (!flight) {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Ошибка при создании рейса'
          })
        });
        return;
      }
      
      const userName = await getlink(context.userId);
      
      // Отправляем сообщение о начале рейса
      await vk.api.messages.send({
        peer_id: context.peerId,
        message: `✈️ Подготовка к вылету\n\nКомандир ВС: ${userName}\nТип ВС: ${flight.aircraft.name}\nМаршрут: ${flight.destination.airport} (${flight.destination.city})\nПассажиров: ${flight.aircraft.passengers}\nДальность: ${flight.destination.distance} км\nРасчётное время: ${flight.destination.duration} мин\n\nНачало предполётной подготовки...`,
        random_id: Math.floor(Math.random() * 1000000)
      });
      
      // Запускаем сценарий полёта
      startFlightScenario(context.userId, context.peerId, flight);
      
      // Отвечаем на callback
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: `✈️ Рейс ${flight.destination.city} начат!`
        })
      });
      
    } catch (error) {
      logger.error('Ошибка при выборе самолёта:', error);
      
      try {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Ошибка при создании рейса'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
  
  // === Обработчики интерактивных кнопок полёта ===
  
  // Кнопки предполётной подготовки (9100, 9101)
  } else if ([9100, 9101].includes(eventPayload.event_id)) {
    try {
      const userId = eventPayload.user_id;
      const actorId = context.userId || (context.object && context.object.user_id);
      const peerId = context.peerId || (context.object && context.object.peer_id);
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);

      // Проверяем, что кнопку нажимает тот, кто начал полёт
      if (actorId !== userId) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Только пилот может принимать решения!'
          })
        });
        return;
      }

      // Проверяем, что полёт еще активен
      const flightData = global.activeFlights && global.activeFlights.get(userId);
      if (!flightData || flightData.stage !== 'preflight') {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Полёт уже завершен или не найден!'
          })
        });
        return;
      }

      // Синхронизируем messageId с текущим сообщением
      flightData.messageId = conversationMessageId;

      const decision = eventPayload.event_id === 9100 ? 'takeoff_now' : 'wait_weather';
      
      // Удаляем кнопки из сообщения
      try {
        await vk.api.messages.edit({
          peer_id: peerId,
          conversation_message_id: conversationMessageId,
          message: `✈️ Решение принято: ${decision === 'takeoff_now' ? '🛫 Взлетаем сейчас!' : '⏰ Ожидаем улучшения погоды'}\n\n⏳ Переход к следующему этапу...`
        });
      } catch (editError) {
        logger.error('Ошибка при удалении кнопок:', editError);
      }

      await startTakeoffStage(userId, peerId, decision);
      
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: decision === 'takeoff_now' ? '✈️ Взлетаем сейчас!' : '⏰ Ожидаем погоду'
        })
      });
    } catch (error) {
      logger.error('Ошибка при обработке кнопки предполётной подготовки:', error);
    }
  
  // Кнопки крейсерского полёта (9102-9107)
  } else if ([9102, 9103, 9104, 9105, 9106, 9107].includes(eventPayload.event_id)) {
    try {
      const userId = eventPayload.user_id;
      const actorId = context.userId || (context.object && context.object.user_id);
      const peerId = context.peerId || (context.object && context.object.peer_id);
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);

      // Проверяем, что кнопку нажимает тот, кто начал полёт
      if (actorId !== userId) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Только пилот может принимать решения!'
          })
        });
        return;
      }

      // Проверяем, что полёт еще активен
      const flightData = global.activeFlights && global.activeFlights.get(userId);
      if (!flightData || flightData.stage !== 'cruise') {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Полёт уже завершен или не найден!'
          })
        });
        return;
      }

      // Удаляем кнопки из сообщения
      try {
        await vk.api.messages.edit({
          peer_id: peerId,
          conversation_message_id: conversationMessageId,
          message: `✅ Решение принято!\n\n⏳ Переход к этапу посадки...`
        });
      } catch (editError) {
        logger.error('Ошибка при удалении кнопок:', editError);
      }

      await startLandingStage(userId, peerId, eventPayload.event_id);
      
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Решение принято!'
        })
      });
    } catch (error) {
      logger.error('Ошибка при обработке кнопки крейсерского полёта:', error);
    }
  
  // Кнопки посадки (9108, 9109)
  } else if ([9108, 9109].includes(eventPayload.event_id)) {
    try {
      const userId = eventPayload.user_id;
      const actorId = context.userId || (context.object && context.object.user_id);
      const peerId = context.peerId || (context.object && context.object.peer_id);
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);

      // Проверяем, что кнопку нажимает тот, кто начал полёт
      if (actorId !== userId) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Только пилот может принимать решения!'
          })
        });
        return;
      }

      // Проверяем, что полёт еще активен
      const flightData = global.activeFlights && global.activeFlights.get(userId);
      if (!flightData || flightData.stage !== 'landing') {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Полёт уже завершен или не найден!'
          })
        });
        return;
      }

      // Удаляем кнопки из сообщения
      try {
        await vk.api.messages.edit({
          peer_id: peerId,
          conversation_message_id: conversationMessageId,
          message: `${eventPayload.event_id === 9108 ? '🎯 Автоматическая посадка' : '✋ Ручная посадка'}\n\n⏳ Завершение полёта...`
        });
      } catch (editError) {
        logger.error('Ошибка при удалении кнопок:', editError);
      }

      await completeInteractiveFlight(userId, peerId, eventPayload.event_id);
      
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: eventPayload.event_id === 9108 ? '🎯 Автоматическая посадка' : '✋ Ручная посадка'
        })
      });
    } catch (error) {
      logger.error('Ошибка при обработке кнопки посадки:', error);
    }
  
  } else if ([9002, 9003, 9004, 9005, 9006].includes(eventPayload.event_id) && eventPayload.command === 'mine_resource') {
    // Обработка кнопок добычи ресурсов
    try {
      const { updateUserResources, getUserResources } = require('./filedb.js');
      const { getlink } = require('./util.js');
      const { isWorking, updateActivity } = require('./workManager.js');
      
      // Проверяем, что пользователь устроился на шахту
      if (!isWorking(context.userId)) {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Сначала устройтесь на шахту!'
          })
        });
        return;
      }
      
      // Обновляем активность работника
      updateActivity(context.userId);
      
      const resourceType = eventPayload.resource;
      const userName = await getlink(context.userId);
      
      // Добавляем 1 единицу ресурса
      const updateResult = await updateUserResources(context.userId, resourceType, 1);
      
      if (!updateResult) {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при добыче ресурса'
          })
        });
        return;
      }
      
      // Получаем обновленные ресурсы
      const resources = await getUserResources(context.userId);
      
      // Названия и стоимость ресурсов
      const resourceInfo = {
        stone: { name: '🪨 Камень', value: 180 },
        coal: { name: '⚫ Уголь', value: 230 },
        iron: { name: '🔩 Железо', value: 350 },
        gold: { name: '🟡 Золото', value: 500 },
        diamond: { name: '💎 Алмаз', value: 1000 }
      };
      
      const resource = resourceInfo[resourceType];
      const totalAmount = resources[resourceType];
      
      // Убираем отправку сообщения в чат - оставляем только snackbar
      
      // Отвечаем на callback
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: `✅ Вы добыли 1 ${resource.name.toLowerCase().replace('🪨 ', '').replace('⚫ ', '').replace('🔩 ', '').replace('🟡 ', '').replace('💎 ', '')}`
        })
      });
      
    } catch (error) {
      logger.error('Ошибка при добыче ресурса:', error);
      
      try {
        const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при добыче ресурса'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
  } else if (eventPayload.event_id === 6913) {
    // Обработка кнопки "Забанить на 7 дней" после кика
    try {
      const { getUserRole } = require('./util.js');
      const { banUser } = require('./cmds/ban.js');
      
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      
      // Проверяем права через checkCommandPriority (как в команде /ban)
      const { checkCommandPriority } = require('./cmds/editcmd.js');
      const hasPermission = await checkCommandPriority(context.peerId, context.userId, '/ban');
      if (!hasPermission) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⛔ У вас недостаточно прав для блокировки пользователей'
          })
        });
        return;
      }
      
      const targetUserId = parseInt(eventPayload.target_user_id);
      const bannedBy = parseInt(eventPayload.banned_by);
      const peerId = context.peerId;
      const banDays = 7;
      const reason = eventPayload.reason || 'Бан на 7 дней после кика';
      
      // Используем существующую функцию banUser для оптимизации
      const banResult = await banUser(peerId, targetUserId, reason, bannedBy, banDays);
      
      if (banResult) {
        // Вычисляем дату окончания бана для отображения
        const currentDate = new Date();
        const blockUntil = new Date(currentDate.getTime() + banDays * 24 * 60 * 60 * 1000);
        
        function formatDate(date) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${day}.${month}.${year} в ${hours}:${minutes}`;
        }
        
        const formattedDate = formatDate(blockUntil);
        
        // Получаем кликабельную ссылку на пользователя
        const utils = require('./util.js');
        const targetUserLink = await utils.getlink(targetUserId);
        
        // Создаем кнопку для разбана
        const { Keyboard } = require('vk-io');
        const keyboard = Keyboard.builder()
          .callbackButton({
            label: '🔴 Снять блокировку',
            payload: {
              button: targetUserId,
              banned_by: bannedBy,
              event_id: 6910,
              global_unban: false
            },
            color: Keyboard.NEGATIVE_COLOR
          })
          .inline();
        
        // Получаем кликабельную ссылку на администратора
        const adminUserLink = await utils.getlink(bannedBy);
        
        // Форматируем дату в нужном формате (день месяц год в часы:минуты по GMT+3)
        function formatDateForBan(date) {
          const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
          ];
          const day = date.getDate();
          const month = months[date.getMonth()];
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${day} ${month} ${year} года в ${hours}:${minutes} по GMT+3`;
        }
        
        const formattedDateForBan = formatDateForBan(blockUntil);
        
        // Отправляем сообщение о бане с кнопкой
        await vk.api.messages.send({
          peer_id: peerId,
          message: `🚷 Пользователь ${targetUserLink} заблокирован до ${formattedDateForBan}.\nПричина: ${reason}.\nРешение принял администратор ${adminUserLink}.`,
          keyboard: keyboard,
          random_id: Math.floor(Math.random() * 1000000)
        });
        
        // Отправляем ответ на callback
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '✅ Пользователь забанен на 7 дней'
          })
        });
      }
      
    } catch (error) {
      logger.error('Ошибка при обработке кнопки бана после кика:', error);
      
      const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
      
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при блокировке пользователя'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
  } else if (eventPayload.event_id === 6912) {
    try {
      let userRole = await getUserRole(context.peerId, context.userId);
      if (userRole >= 40) {
        // Баним пользователя на 7 дней
        const currentDate = new Date();
        const blockUntil = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        const blockInfo = {
          blocked_user_id: parseInt(eventPayload.button),
          blocked_by: context.userId,
          block_until: blockUntil,
          reason: 'Бан на 7 дней после кика',
        };

        const selectBlockedUsersQuery = `
          SELECT blocked_users
          FROM conference_${context.peerId}
          WHERE user_id = ?
        `;

        const selectResults = await databaseQuery(selectBlockedUsersQuery, [eventPayload.button]);

        let blockedUsers = [];
        if (selectResults.length > 0 && selectResults[0].blocked_users) {
          try {
            blockedUsers = selectResults[0].blocked_users.trim() ? JSON.parse(selectResults[0].blocked_users) : [];
          } catch { blockedUsers = []; }
        }

        // Добавляем или обновляем блокировку
        const existingBlockIndex = blockedUsers.findIndex(block =>
          parseInt(block.blocked_user_id) === parseInt(eventPayload.button)
        );

        if (existingBlockIndex !== -1) {
          blockedUsers[existingBlockIndex] = blockInfo;
        } else {
          blockedUsers.push(blockInfo);
        }

        const updateBlockedUsersQuery = `
          INSERT INTO conference_${context.peerId} (user_id, blocked_users)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE blocked_users = VALUES(blocked_users)
        `;

        await databaseQuery(updateBlockedUsersQuery, [eventPayload.button, JSON.stringify(blockedUsers)]);

        // Получаем информацию о пользователях
        const userInfo = await vk.api.users.get({ user_ids: eventPayload.button });
        const adminInfo = await vk.api.users.get({ user_ids: context.userId });

        const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
        const adminName = adminInfo[0] ? `${adminInfo[0].first_name} ${adminInfo[0].last_name}` : 'Администратор';

        await vk.api.messages.send({
          peer_id: context.peerId,
          message: `🚫 [id${eventPayload.button}|${userName}] заблокирован на 7 дней\n👮‍♂️ Заблокировал: [id${context.userId}|${adminName}]`,
          random_id: generateRandom32BitNumber(),
        });
      } else {
        await vk.api.messages.send({
          peer_id: context.peerId,
          message: `⛔ Доступ запрещен | У вас недостаточно прав для блокировки пользователей\n👑 Требуемый уровень: Администратор`,
          random_id: generateRandom32BitNumber(),
        });
      }
    } catch (error) {
      logger.error('Ошибка при блокировке пользователя:', error);
      await vk.api.messages.send({
        peer_id: context.peerId,
        message: `❌ Ошибка системы | Не удалось заблокировать пользователя`,
        random_id: generateRandom32BitNumber(),
      });
    }
  }
  // === Обработка кнопки снятия бана ===
  if (eventPayload && eventPayload.event_id === 6910) {
    const bannedUserId = parseInt(eventPayload.button);
    const bannedBy = parseInt(eventPayload.banned_by);
    const actorId = context.userId;
    const peerId = context.peerId;
    const isGlobalUnban = eventPayload.global_unban === true;
    const { getUserRole } = require('./util.js');

    const actorRole = await getUserRole(peerId, actorId);
    const bannerRole = await getUserRole(peerId, bannedBy);

    // Корректно определяем eventId для VK API
    let eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    if (actorId !== bannedBy && actorRole <= bannerRole) {
      const errorText = isGlobalUnban
        ? '⛔ Только забанивший или пользователь с более высокой ролью может снять глобальную блокировку.'
        : '⛔ Только забанивший или пользователь с более высокой ролью может снять блокировку.';
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: errorText
        })
      });
      return;
    }

    // Глобальные кнопки разбана больше не поддерживаются
    if (isGlobalUnban) {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '⚠️ Глобальные кнопки разбана больше не поддерживаются.'
        })
      });
      return;
    }

    // Работаем с SQL базой данных (как banUser и banlist)
    const selectQuery = `SELECT blocked_users FROM conference_${peerId} WHERE user_id = ?`;
    
    database.query(selectQuery, [bannedUserId], async (error, results) => {
      if (error) {
        logger.error('Ошибка при проверке бана пользователя:', error);
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Ошибка системы'
          })
        });
        return;
      }

      if (!results || results.length === 0) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Пользователь не найден в базе данных'
          })
        });
        return;
      }

      const userData = results[0];
      let blockedUsers = [];
      
      if (userData.blocked_users) {
        try {
          blockedUsers = userData.blocked_users.trim() ? JSON.parse(userData.blocked_users) : [];
        } catch (e) {
          logger.error('Ошибка парсинга blocked_users:', e);
          blockedUsers = [];
        }
      }

      // Проверяем, есть ли блокировка этого пользователя
      const blockIndex = blockedUsers.findIndex(block => 
        parseInt(block.blocked_user_id) === parseInt(bannedUserId)
      );
      
      if (blockIndex === -1) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Пользователь не заблокирован'
          })
        });
        return;
      }

      // Удаляем блокировку из массива
      const updatedBlockedUsers = blockedUsers.filter(block => 
        parseInt(block.blocked_user_id) !== parseInt(bannedUserId)
      );

      // Обновляем запись в базе данных
      const updateQuery = `UPDATE conference_${peerId} SET blocked_users = ? WHERE user_id = ?`;
      
      database.query(updateQuery, [JSON.stringify(updatedBlockedUsers), bannedUserId], async (updateError) => {
        if (updateError) {
          logger.error('Ошибка при разблокировке пользователя:', updateError);
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ Ошибка системы'
            })
          });
          return;
        }

        // Получаем кликабельные ссылки
        const utils = require('./util.js');
        const bannedUserLink = await utils.getlink(bannedUserId);
        const adminUserLink = await utils.getlink(actorId);
        
        // Отправляем сообщение о разблокировке
        await vk.api.messages.send({
          peer_id: peerId,
          message: `✅️ ${bannedUserLink} разблокирован ${adminUserLink}.`,
          random_id: Date.now(),
        });
        
        // Отправляем ответ на callback
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '✅ Пользователь разблокирован'
          })
        });
      });
    });
    return;
  }

  // === Обработка кнопки глобального снятия бана ===
  if (eventPayload && eventPayload.event_id === 6911) {
    const bannedUserId = parseInt(eventPayload.button);
    const bannedBy = parseInt(eventPayload.banned_by);
    const actorId = context.userId;
    const peerId = context.peerId;
    const { getUserRole } = require('./util.js');

    const actorRole = await getUserRole(peerId, actorId);
    const bannerRole = await getUserRole(peerId, bannedBy);

    // Корректно определяем eventId для VK API
    let eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    // Проверяем права на снятие глобального бана
    if (actorId !== bannedBy && actorRole <= bannerRole) {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '⛔ Только забанивший или пользователь с более высокой ролью может снять глобальную блокировку.'
        })
      });
      return;
    }

    // Получаем информацию об администраторе
    let adminName = 'Администратор';
    try {
      const adminInfo = await vk.api.users.get({ user_ids: actorId });
      if (adminInfo && adminInfo[0]) {
        adminName = `${adminInfo[0].first_name} ${adminInfo[0].last_name}`;
      }
    } catch { }

    // Снимаем глобальный бан
    try {
      // 1. Удаляем из глобального банлиста
      const fs = require('fs');
      const path = require('path');
      const banlistFile = path.join(__dirname, 'data', 'banlist', `${peerId}.json`);
      if (fs.existsSync(banlistFile)) {
        let banlist = {};
        try {
          banlist = JSON.parse(fs.readFileSync(banlistFile, 'utf8'));
          delete banlist[bannedUserId];
          fs.writeFileSync(banlistFile, JSON.stringify(banlist, null, 2));
        } catch (e) {
          logger.error('Ошибка при удалении из глобального банлиста:', e);
        }
      }

      // 2. Снимаем бан во всех чатах пулла
      const poolsDir = path.join(__dirname, 'data', 'pools');
      if (fs.existsSync(poolsDir)) {
        const poolFiles = fs.readdirSync(poolsDir);
        let totalUnbanCount = 0;

        for (const file of poolFiles) {
          try {
            const poolData = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
            if (Array.isArray(poolData.pool_peerids) && poolData.pool_peerids.includes(String(peerId))) {
              // Этот пулл содержит наш чат
              for (const poolPeerId of poolData.pool_peerids) {
                try {
                  // Снимаем бан в каждом чате пулла
                  const selectAllQuery = `SELECT user_id, blocked_users FROM conference_${poolPeerId}`;
                  database.query(selectAllQuery, [], (error, results) => {
                    if (error) return;

                    const async = require('async');
                    async.each(results, (row, cb) => {
                      let blockedUsers = [];
                      if (row.blocked_users) {
                        try {
                          blockedUsers = row.blocked_users.trim() ? JSON.parse(row.blocked_users) : [];
                        } catch { blockedUsers = []; }
                      }

                      const initialLength = blockedUsers.length;
                      blockedUsers = blockedUsers.filter(block => parseInt(block.blocked_user_id) !== bannedUserId);

                      if (blockedUsers.length !== initialLength) {
                        const updateQuery = `UPDATE conference_${poolPeerId} SET blocked_users = ? WHERE user_id = ?`;
                        database.query(updateQuery, [JSON.stringify(blockedUsers), row.user_id], cb);
                        totalUnbanCount++;
                      } else {
                        cb();
                      }
                    });
                  });
                } catch (e) {
                  logger.error(`Ошибка при снятии бана в чате ${poolPeerId}:`, e);
                }
              }
            }
          } catch (e) {
            logger.error(`Ошибка при обработке пулла ${file}:`, e);
          }
        }
      }

      // Добавляем запись в журнал действий
      try {
        const { addLog } = require('./utils/logs.js');
        await addLog(peerId, actorId, bannedUserId, 'global_unban', `Глобальное снятие блокировки во всех связанных чатах пулла`);
      } catch (logError) {
        logger.error('Ошибка при логировании глобального разбана:', logError);
      }

      // Получаем кликабельные ссылки для оформления
      const targetLink = await utils.getlink(bannedUserId);
      const adminLink = await utils.getlink(actorId);
      
      await vk.api.messages.send({
        peer_id: peerId,
        message: `✅ ${targetLink} глобально разблокирован ${adminLink}.`,
        random_id: Date.now(),
      });

    } catch (error) {
      logger.error('Ошибка при снятии глобального бана:', error);
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Произошла ошибка при снятии глобальной блокировки.'
        })
      });
    }
    return;
  }

  // === Обработка кнопки снятия мута ===
  if (eventPayload && eventPayload.event_id === 6914) {
    const targetUserId = parseInt(eventPayload.target_user_id);
    const mutedBy = parseInt(eventPayload.muted_by);
    const actorId = context.userId;
    const peerId = context.peerId;
    const { getUserRole } = require('./util.js');
    const { checkCommandPriority } = require('./cmds/editcmd.js');

    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    try {
      // Проверяем права через checkCommandPriority (как в команде /mute)
      const hasPermission = await checkCommandPriority(peerId, actorId, '/mute');
      if (!hasPermission) {
        const actorRole = await getUserRole(peerId, actorId);
        const mutedByRole = await getUserRole(peerId, mutedBy);
        
        // Дополнительная проверка: может ли пользователь снять мут (тот кто замутил или выше рангом)
        if (actorId !== mutedBy && actorRole <= mutedByRole) {
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '⛔ У вас недостаточно прав для снятия мута'
            })
          });
          return;
        }
      }

      // Снимаем мут через VK API
      await vk.api.messages.changeConversationMemberRestrictions({
        peer_id: peerId,
        member_ids: [targetUserId],
        action: "rw" // read-write (снимаем ограничения)
      });

      // Удаляем информацию о муте из глобального объекта
      if (global.mutedUsersInfo && global.mutedUsersInfo[peerId] && global.mutedUsersInfo[peerId][targetUserId]) {
        delete global.mutedUsersInfo[peerId][targetUserId];
      }

      // Получаем кликабельные ссылки
      const utils = require('./util.js');
      const targetUserLink = await utils.getlink(targetUserId);
      const adminUserLink = await utils.getlink(actorId);

      // Добавляем запись в журнал действий
      try {
        const { addLog } = require('./utils/logs.js');
        await addLog(peerId, actorId, targetUserId, 'unmute', 'Снятие мута через кнопку');
      } catch (logError) {
        logger.error('Ошибка при логировании снятия мута:', logError);
      }

      // Отправляем сообщение о снятии мута
      await vk.api.messages.send({
        peer_id: peerId,
        message: `🔊 ${targetUserLink} размучен ${adminUserLink}.`,
        random_id: Date.now(),
      });

      // Отправляем ответ на callback
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Мут снят'
        })
      });

    } catch (error) {
      logger.error('Ошибка при снятии мута:', error);
      
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при снятии мута'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
    return;
  }

  // === Обработка кнопки отмены предупреждения ===
  if (eventPayload && eventPayload.event_id === 6920) {
    const targetUserId = parseInt(eventPayload.target_user);
    const warnAuthor = parseInt(eventPayload.warn_author);
    const actorId = context.userId;
    const peerId = context.peerId;
    const { getUserRole } = require('./util.js');
    const { getlink } = require('./util.js');
    const { addLog } = require('./utils/logs.js');

    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    try {
      // Проверяем права: отменить может тот кто выдал или пользователь с равной/выше ролью
      const actorRole = await getUserRole(peerId, actorId);
      const authorRole = await getUserRole(peerId, warnAuthor);

      if (actorId !== warnAuthor && actorRole < authorRole) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⛔ У вас недостаточно прав для отмены этого предупреждения'
          })
        });
        return;
      }

      // Получаем текущую информацию о пользователе
      const selectUserQuery = `
        SELECT warns, warns_history
        FROM conference_${peerId}
        WHERE user_id = ?
      `;

      database.query(selectUserQuery, [targetUserId], async (error, results) => {
        if (error) {
          logger.error('Ошибка при получении данных пользователя:', error);
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ Ошибка при получении данных пользователя'
            })
          });
          return;
        }

        if (results.length === 0) {
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ Пользователь не найден'
            })
          });
          return;
        }

        const { warns: warnsRaw, warns_history } = results[0];
        const warns = parseInt(warnsRaw) || 0;

        if (warns <= 0) {
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ У пользователя нет активных предупреждений'
            })
          });
          return;
        }

        // Уменьшаем количество предупреждений и убираем последнюю запись из истории
        const updatedWarns = warns - 1;
        let updatedHistory = warns_history ? JSON.parse(warns_history) : [];
        
        // Убираем последнюю запись из истории
        if (updatedHistory.length > 0) {
          updatedHistory.pop();
        }

        const updateUserQuery = `
          UPDATE conference_${peerId}
          SET warns = ?, warns_history = ?
          WHERE user_id = ?
        `;

        database.query(updateUserQuery, [updatedWarns, JSON.stringify(updatedHistory), targetUserId], async (updateError) => {
          if (updateError) {
            logger.error('Ошибка при обновлении данных пользователя:', updateError);
            await vk.api.messages.sendMessageEventAnswer({
              event_id: eventId,
              user_id: actorId,
              peer_id: peerId,
              event_data: JSON.stringify({
                type: 'show_snackbar',
                text: '❌ Ошибка при отмене предупреждения'
              })
            });
            return;
          }

          // Добавляем запись в журнал действий
          addLog(peerId, actorId, targetUserId, 'unwarn', `Отменено предупреждение. Осталось: ${updatedWarns}/3`)
            .catch(err => logger.error('Ошибка при логировании отмены предупреждения:', err));

          // Получаем ссылки на пользователей и роль
          const { getUserRole, getRoleName } = require('./cmds/roles.js');
          const actorRole = await getUserRole(peerId, actorId);
          const roleName = await getRoleName(peerId, actorRole);
          const actorLink = await getlink(actorId);
          const targetLink = await getlink(targetUserId);

          // Отправляем подтверждение об отмене (оформление как в unwarn)
          await vk.api.messages.send({
            peer_id: peerId,
            message: `✅️ ${actorLink} | ${roleName} снял предупреждение с ${targetLink}`,
            random_id: Math.floor(Math.random() * 2000000000)
          });

          // Отвечаем на callback
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '✅ Предупреждение отменено'
            })
          });
        });
      });

    } catch (error) {
      logger.error('Ошибка при обработке отмены предупреждения:', error);
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при отмене предупреждения'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
    return;
  }

  // === Обработка кнопки "Исключить" ===
  if (eventPayload && eventPayload.event_id === 7777 && eventPayload.command === 'exclude_user') {
    const targetUserId = parseInt(eventPayload.user_id);
    const actorId = context.userId;
    const peerId = context.peerId;
    const { getUserRole } = require('./util.js');
    const { checkCommandPriority } = require('./cmds/editcmd.js');

    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    try {
      // Проверяем права через checkCommandPriority (как в команде /kick)
      const hasPermission = await checkCommandPriority(peerId, actorId, '/kick');
      if (!hasPermission) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⛔ У вас недостаточно прав для исключения пользователей'
          })
        });
        return;
      }

      // Исключаем пользователя из чата
      await vk.api.messages.removeChatUser({
        chat_id: peerId - 2000000000,
        member_id: targetUserId,
      });

      // Получаем кликабельные ссылки
      const utils = require('./util.js');
      const targetUserLink = await utils.getlink(targetUserId);
      const adminUserLink = await utils.getlink(actorId);

      // Отправляем сообщение об исключении
      await vk.api.messages.send({
        peer_id: peerId,
        message: `✅ ${targetUserLink} исключен из чата ${adminUserLink}.`,
        random_id: Date.now(),
      });

      // Отвечаем на callback
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Пользователь исключен'
        })
      });

      // Добавляем запись в журнал действий
      try {
        const { addLog } = require('./utils/logs.js');
        await addLog(peerId, actorId, targetUserId, 'kick', 'Исключение через кнопку после выхода');
      } catch (logError) {
        logger.error('Ошибка при логировании исключения:', logError);
      }

    } catch (error) {
      logger.error('Ошибка при исключении пользователя:', error);
      
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка при исключении'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
    return;
  }

  // === Обработка кнопки "Никнеймы" ===
  if (eventPayload && eventPayload.event_id === 8888 && eventPayload.command === 'show_nicknames') {
    const peerId = context.peerId;
    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
    const { checkIfTableExists } = require('./util.js');

    try {
      if (!await checkIfTableExists(`nicknames_${peerId}`)) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⚠️ Беседа не активирована'
          })
        });
        return;
      }

      const selectNicknamesQuery = `SELECT user_id, nickname FROM nicknames_${peerId}`;
      
      database.query(selectNicknamesQuery, async (error, results) => {
        if (error) {
          logger.error('Ошибка при выводе списка никнеймов:', error);
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: context.userId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ Ошибка при получении никнеймов'
            })
          });
          return;
        }

        if (results.length === 0) {
          await vk.api.messages.send({
            peer_id: peerId,
            message: '📋 Список никнеймов пуст | В беседе нет пользователей с установленными никами',
            random_id: Date.now()
          });
          
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: context.userId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '📋 Список никнеймов пуст'
            })
          });
          return;
        }

        const userIds = results.map(nickInfo => nickInfo.user_id);

        try {
          const userInfos = await vk.api.users.get({ user_ids: userIds });
          const userMap = userInfos.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {});

          let message = '👥 Список пользователей с никами:\n\n';
          for (let i = 0; i < results.length; i++) {
            const nickInfo = results[i];
            const userInfo = userMap[nickInfo.user_id];
            if (userInfo) {
              message += `${i + 1}. [id${userInfo.id}|${userInfo.first_name} ${userInfo.last_name}] - ${nickInfo.nickname}\n`;
            }
          }

          await vk.api.messages.send({
            peer_id: peerId,
            message: message,
            random_id: Date.now()
          });

          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: context.userId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '✅ Список никнеймов отправлен'
            })
          });

        } catch (vkError) {
          logger.error('Ошибка VK API при получении информации о пользователях:', vkError);
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: context.userId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ Ошибка при получении данных пользователей'
            })
          });
        }
      });

    } catch (error) {
      logger.error('Ошибка при обработке кнопки никнеймов:', error);
      
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
    return;
  }

  // === Обработка кнопок топа ===
  if (eventPayload && ['top_balance', 'top_reputation', 'top_messages', 'top_games', 'top_chats'].includes(eventPayload.command)) {
    const { showBalanceTop, showReputationTop, showMessagesTop, showGamesTop, showChatsTop, createTopKeyboard } = require('./cmds/top.js');
    
    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
    let message = '';
    
    try {
      switch (eventPayload.command) {
        case 'top_balance':
          message = await showBalanceTop(context);
          break;
        case 'top_reputation':
          message = await showReputationTop(context);
          break;
        case 'top_messages':
          message = await showMessagesTop(context);
          break;
        case 'top_games':
          message = await showGamesTop(context);
          break;
        case 'top_chats':
          message = await showChatsTop(context);
          break;
        default:
          message = await showBalanceTop(context);
      }
      
      const keyboard = createTopKeyboard();
      
      // Отправляем обновленное сообщение
      await vk.api.messages.edit({
        peer_id: context.peerId,
        conversation_message_id: context.conversationMessageId,
        message: message,
        keyboard: keyboard
      });
      
      // Отправляем ответ на callback с указанием типа топа
      let snackbarText = '✅ Топ обновлен';
      switch (eventPayload.command) {
        case 'top_balance':
          snackbarText = '💰 Топ по балансу';
          break;
        case 'top_reputation':
          snackbarText = '🏆 Топ по репутации';
          break;
        case 'top_messages':
          snackbarText = '📊 Топ по сообщениям';
          break;
        case 'top_games':
          snackbarText = '🎮 Топ по играм';
          break;
        case 'top_chats':
          snackbarText = '💬 Топ по беседам';
          break;
      }
      
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: context.userId,
        peer_id: context.peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: snackbarText
        })
      });
      
    } catch (error) {
      logger.error('Ошибка при обработке кнопки топа:', error);
      
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: context.userId,
          peer_id: context.peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
    return;
  }

  // === Обработка кнопок брака ===
  if (eventPayload && (eventPayload.command === 'marriage_accept' || eventPayload.command === 'marriage_reject')) {
    const fs = require('fs');
    const path = require('path');
    const userId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);
    const eventId = context.event_id;

    const { from_id, to_id } = eventPayload;

    // Проверяем, что кнопку нажимает тот, кому сделали предложение
    if (userId !== to_id) {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: userId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Только тот, кому сделали предложение, может ответить!'
        })
      });
      return;
    }

    const offersFile = path.join(__dirname, 'data', `marriage_offers_${peerId}.json`);
    const marriagesFile = path.join(__dirname, 'data', `marriages_${peerId}.json`);
    let offers = [];
    let marriages = [];

    try {
      if (fs.existsSync(offersFile)) {
        offers = JSON.parse(fs.readFileSync(offersFile, 'utf8'));
      }
    } catch (e) { offers = []; }

    try {
      if (fs.existsSync(marriagesFile)) {
        marriages = JSON.parse(fs.readFileSync(marriagesFile, 'utf8'));
      }
    } catch (e) { marriages = []; }

    // Ищем предложение
    const offerIdx = offers.findIndex(o => o.from_id === from_id && o.to_id === to_id);
    if (offerIdx === -1) {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: userId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Предложение не найдено или уже обработано'
        })
      });
      return;
    }

    const offer = offers[offerIdx];

    if (eventPayload.command === 'marriage_accept') {
      // Принятие предложения
      let fromName = `[id${offer.from_id}|Пользователь]`;
      let toName = `[id${offer.to_id}|Пользователь]`;

      try {
        const users = await vk.api.users.get({ user_ids: `${offer.from_id},${offer.to_id}` });
        if (users && users.length === 2) {
          fromName = `[id${offer.from_id}|${users[0].first_name} ${users[0].last_name}]`;
          toName = `[id${offer.to_id}|${users[1].first_name} ${users[1].last_name}]`;
        }
      } catch (e) { }

      marriages.push({ user1: offer.from_id, user2: offer.to_id, date: Date.now() });
      fs.writeFileSync(marriagesFile, JSON.stringify(marriages, null, 2));
      offers.splice(offerIdx, 1);
      fs.writeFileSync(offersFile, JSON.stringify(offers, null, 2));

      // Удаляем сообщение с кнопками
      try {
        await vk.api.messages.delete({
          peer_id: peerId,
          conversation_message_ids: conversationMessageId,
          delete_for_all: 1
        });
      } catch (e) { }

      // Отправляем сообщение о принятии
      await vk.api.messages.send({
        peer_id: peerId,
        message: `💞 Поздравляем! ${toName} принял(-а) предложение о браке от ${fromName}! Теперь вы официально в браке!`,
        random_id: Date.now()
      });

      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: userId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '💞 Вы приняли предложение!'
        })
      });
    } else {
      // Отклонение предложения
      offers.splice(offerIdx, 1);
      fs.writeFileSync(offersFile, JSON.stringify(offers, null, 2));

      // Удаляем сообщение с кнопками
      try {
        await vk.api.messages.delete({
          peer_id: peerId,
          conversation_message_ids: conversationMessageId,
          delete_for_all: 1
        });
      } catch (e) { }

      // Отправляем сообщение об отказе
      await vk.api.messages.send({
        peer_id: peerId,
        message: '❌ Предложение о браке отклонено.',
        random_id: Date.now()
      });

      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: userId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Вы отклонили предложение'
        })
      });
    }
    return;
  }

  // === Обработка кнопки "Исключить" при выходе из чата ===
  if (eventPayload && eventPayload.event_id === 7777 && eventPayload.command === 'exclude_user') {
    const excludeUserId = eventPayload.user_id;
    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.event_id;

    try {
      // Проверяем права пользователя
      const actorRole = await getUserRole(peerId, actorId);

      if (actorRole < 40) { // Только администраторы и выше могут исключать
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ У вас недостаточно прав для исключения пользователей'
          })
        });
        return;
      }

      // Исключаем пользователя из чата
      try {
        await vk.api.messages.removeChatUser({
          chat_id: peerId - 2000000000,
          member_id: excludeUserId
        });

        // Получаем информацию об администраторе
        let adminName = 'Администратор';
        try {
          const adminInfo = await vk.api.users.get({ user_ids: actorId });
          if (adminInfo && adminInfo[0]) {
            adminName = `${adminInfo[0].first_name} ${adminInfo[0].last_name}`;
          }
        } catch (error) {
          logger.error('Ошибка при получении информации об администраторе:', error);
        }

        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: `✅ Пользователь исключен из чата`
          })
        });

        // Отправляем сообщение в чат
        await vk.api.messages.send({
          peer_id: peerId,
          message: `✅ ${await utils.getlink(excludeUserId)} был исключен из чата\n👮‍♂️ Исключил: [id${actorId}|${adminName}]`,
          random_id: Date.now()
        });

      } catch (error) {
        logger.error('Ошибка при исключении пользователя:', error);

        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Не удалось исключить пользователя'
          })
        });
      }

    } catch (error) {
      logger.error('Ошибка при обработке кнопки исключения:', error);
    }
    return;
  }

  // === Обработка кнопок редактирования доступа к командам ===
  if (eventPayload && eventPayload.command === 'toggle_command_access') {
    const { target_id, cmd_key, editor_id, page } = eventPayload;
    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.eventId; // Используем context.eventId напрямую
    const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);

    logger.log('🔄 Обработка toggle_command_access:', { target_id, cmd_key, editor_id, page, eventId });

    // Проверяем, что кнопку нажимает тот, кто открыл меню
    if (actorId !== editor_id) {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Только инициатор редактирования может изменять права'
        })
      });
      return;
    }

    try {
      const { checkSysAccess, canManageAccess } = require('./cmds/sysadmin.js');
      const { getUserCommandAccess, updateCommandAccess } = require('./cmds/edit.js');
      
      // Проверяем права
      const userAccess = await checkSysAccess(actorId);
      const targetAccess = await checkSysAccess(target_id);
      
      if (!canManageAccess(userAccess, targetAccess)) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ У вас недостаточно прав для изменения доступа этого пользователя'
          })
        });
        return;
      }

      // Получаем текущий доступ к команде
      const targetInfo = await getUserCommandAccess(target_id);
      const currentAccess = targetInfo.commandAccess[cmd_key];
      const newAccess = !currentAccess;
      
      logger.log(`🔄 Переключаем доступ к команде ${cmd_key}: ${currentAccess} -> ${newAccess}`);
      
      // Обновляем доступ к команде через файловую систему
      const updateResult = await updateCommandAccess(target_id, cmd_key, newAccess);
      
      if (!updateResult) {
        throw new Error(`Не удалось обновить доступ к команде ${cmd_key}`);
      }

      // Получаем обновленную информацию
      const updatedTargetInfo = await getUserCommandAccess(target_id);
      
      // Получаем информацию о пользователе
      let targetName = 'Пользователь';
      try {
        const userInfo = await vk.api.users.get({ user_ids: target_id });
        if (userInfo && userInfo[0]) {
          targetName = `${userInfo[0].first_name} ${userInfo[0].last_name}`;
        }
      } catch (error) {
        logger.error('Ошибка при получении информации о пользователе:', error);
      }

      // Получаем системные команды из edit.js
      const systemCommands = {
        ticket: { name: '!ticket', minAccess: 1 },
        answer: { name: '!answer', minAccess: 1 },
        banreport: { name: '!banreport', minAccess: 1 },
        unbanreport: { name: '!unbanreport', minAccess: 1 },
        rbanlist: { name: '!rbanlist', minAccess: 1 },
        sysadmins: { name: '!sysadmins', minAccess: 1 },
        sysban: { name: '!sysban', minAccess: 2 },
        unsysban: { name: '!unsysban', minAccess: 2 },
        sysrole: { name: '!sysrole', minAccess: 3 },
        пополнить: { name: '!пополнить', minAccess: 4 },
        notif: { name: '!notif', minAccess: 3 },
        edit: { name: '!edit', minAccess: 3 },
        giveagent: { name: '!giveagent', minAccess: 2 },
        giveadm: { name: '!giveadm', minAccess: 3 },
        givezam: { name: '!givezam', minAccess: 4 },
        giveowner: { name: '!giveowner', minAccess: 5 },
        null: { name: '!null', minAccess: 2 }
      };

      // Формируем сообщение
      let message = `🎛️ Редактирование прав доступа | 👤 ${targetName} | 🔑 ${getAccessLevelName(updatedTargetInfo.sysAccess)}\n\n`;
      message += `📋 Нажмите кнопку для переключения доступа\n\n`;

      // Создаем клавиатуру с пагинацией (как в edit.js)
      const keyboard = Keyboard.builder();
      const commandEntries = Object.entries(systemCommands);
      const pageSize = 3; // Максимум 3 команды на страницу
      const currentPage = page || 0;
      const totalPages = Math.ceil(commandEntries.length / pageSize);
      
      // Получаем команды для текущей страницы
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, commandEntries.length);
      const currentPageCommands = commandEntries.slice(startIndex, endIndex);
      
      logger.log(`📋 Обновляем страницу ${currentPage + 1}/${totalPages}, команды ${startIndex + 1}-${endIndex}`);
      
      // Добавляем кнопки команд для текущей страницы
      for (const [cmdKey, cmdInfo] of currentPageCommands) {
        const hasAccess = updatedTargetInfo.commandAccess[cmdKey];
        const color = hasAccess ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR;
        const emoji = hasAccess ? '✅' : '❌';
        
        keyboard.callbackButton({
          label: `${emoji} ${cmdInfo.name}`,
          payload: {
            command: 'toggle_command_access',
            target_id: target_id,
            cmd_key: cmdKey,
            editor_id: editor_id,
            page: currentPage
          },
          color: color
        });
        keyboard.row(); // Каждая кнопка на отдельной строке
      }
      
      // Добавляем навигационные кнопки если страниц больше одной
      if (totalPages > 1) {
        const navButtons = [];
        if (currentPage > 0) {
          navButtons.push({
            label: '◀️ Назад',
            payload: {
              command: 'edit_page_nav',
              target_id: target_id,
              page: currentPage - 1,
              editor_id: editor_id
            },
            color: Keyboard.PRIMARY_COLOR
          });
        }
        if (currentPage < totalPages - 1) {
          navButtons.push({
            label: 'Вперёд ▶️',
            payload: {
              command: 'edit_page_nav',
              target_id: target_id,
              page: currentPage + 1,
              editor_id: editor_id
            },
            color: Keyboard.PRIMARY_COLOR
          });
        }
        
        // Добавляем навигационные кнопки в один ряд
        for (const btn of navButtons) {
          keyboard.callbackButton(btn);
        }
        if (navButtons.length > 0) keyboard.row();
      }
      
      // Добавляем кнопку закрытия
      keyboard.callbackButton({
        label: '❌ Закрыть',
        payload: {
          command: 'close_edit_menu',
          editor_id: editor_id
        },
        color: Keyboard.SECONDARY_COLOR
      });

      // Обновляем сообщение
      await vk.api.messages.edit({
        peer_id: peerId,
        conversation_message_id: conversationMessageId,
        message: message,
        keyboard: keyboard.inline()
      });

      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: `✅ Доступ к команде ${systemCommands[cmd_key].name} ${newAccess ? 'выдан' : 'отозван'}`
        })
      });

    } catch (error) {
      logger.error('Ошибка при изменении доступа к команде:', error);
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Произошла ошибка при изменении доступа'
        })
      });
    }
    return;
  }

  // === Обработка навигации по страницам редактирования ===
  if (eventPayload && eventPayload.command === 'edit_page_nav') {
    const { target_id, page, editor_id } = eventPayload;
    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.eventId; // Используем context.eventId напрямую
    const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);

    logger.log('📄 Обработка edit_page_nav:', { target_id, page, editor_id, eventId });

    // Проверяем, что кнопку нажимает тот, кто открыл меню
    if (actorId !== editor_id) {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Только инициатор редактирования может листать страницы'
        })
      });
      return;
    }

    try {
      const { getUserCommandAccess } = require('./cmds/edit.js');
      
      // Получаем информацию о пользователе
      const targetInfo = await getUserCommandAccess(target_id);
      
      // Получаем имя пользователя
      let targetName = 'Пользователь';
      try {
        const userInfo = await vk.api.users.get({ user_ids: target_id });
        if (userInfo && userInfo[0]) {
          targetName = `${userInfo[0].first_name} ${userInfo[0].last_name}`;
        }
      } catch (error) {
        logger.error('Ошибка при получении информации о пользователе:', error);
      }

      // Получаем системные команды
      const systemCommands = {
        ticket: { name: '!ticket', minAccess: 1 },
        answer: { name: '!answer', minAccess: 1 },
        banreport: { name: '!banreport', minAccess: 1 },
        unbanreport: { name: '!unbanreport', minAccess: 1 },
        rbanlist: { name: '!rbanlist', minAccess: 1 },
        sysadmins: { name: '!sysadmins', minAccess: 1 },
        sysban: { name: '!sysban', minAccess: 2 },
        unsysban: { name: '!unsysban', minAccess: 2 },
        sysrole: { name: '!sysrole', minAccess: 3 },
        пополнить: { name: '!пополнить', minAccess: 4 },
        notif: { name: '!notif', minAccess: 3 },
        edit: { name: '!edit', minAccess: 3 },
        giveagent: { name: '!giveagent', minAccess: 2 },
        giveadm: { name: '!giveadm', minAccess: 3 },
        givezam: { name: '!givezam', minAccess: 4 },
        giveowner: { name: '!giveowner', minAccess: 5 },
        null: { name: '!null', minAccess: 2 }
      };

      // Формируем сообщение
      let message = `🎛️ Редактирование прав доступа | 👤 ${targetName} | 🔑 ${getAccessLevelName(targetInfo.sysAccess)}\n\n`;
      message += `📋 Нажмите кнопку для переключения доступа\n\n`;

      // Создаем клавиатуру с пагинацией
      const keyboard = Keyboard.builder();
      const commandEntries = Object.entries(systemCommands);
      const pageSize = 3;
      const currentPage = page;
      const totalPages = Math.ceil(commandEntries.length / pageSize);
      
      // Получаем команды для текущей страницы
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, commandEntries.length);
      const currentPageCommands = commandEntries.slice(startIndex, endIndex);
      
      logger.log(`📋 Переход на страницу ${currentPage + 1}/${totalPages}, команды ${startIndex + 1}-${endIndex}`);
      
      // Добавляем кнопки команд для текущей страницы
      for (const [cmdKey, cmdInfo] of currentPageCommands) {
        const hasAccess = targetInfo.commandAccess[cmdKey];
        const color = hasAccess ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR;
        const emoji = hasAccess ? '✅' : '❌';
        
        keyboard.callbackButton({
          label: `${emoji} ${cmdInfo.name}`,
          payload: {
            command: 'toggle_command_access',
            target_id: target_id,
            cmd_key: cmdKey,
            editor_id: editor_id,
            page: currentPage
          },
          color: color
        });
        keyboard.row();
      }
      
      // Добавляем навигационные кнопки если страниц больше одной
      if (totalPages > 1) {
        const navButtons = [];
        if (currentPage > 0) {
          navButtons.push({
            label: '◀️ Назад',
            payload: {
              command: 'edit_page_nav',
              target_id: target_id,
              page: currentPage - 1,
              editor_id: editor_id
            },
            color: Keyboard.PRIMARY_COLOR
          });
        }
        if (currentPage < totalPages - 1) {
          navButtons.push({
            label: 'Вперёд ▶️',
            payload: {
              command: 'edit_page_nav',
              target_id: target_id,
              page: currentPage + 1,
              editor_id: editor_id
            },
            color: Keyboard.PRIMARY_COLOR
          });
        }
        
        for (const btn of navButtons) {
          keyboard.callbackButton(btn);
        }
        if (navButtons.length > 0) keyboard.row();
      }
      
      // Добавляем кнопку закрытия
      keyboard.callbackButton({
        label: '❌ Закрыть',
        payload: {
          command: 'close_edit_menu',
          editor_id: editor_id
        },
        color: Keyboard.SECONDARY_COLOR
      });

      // Обновляем сообщение
      await vk.api.messages.edit({
        peer_id: peerId,
        conversation_message_id: conversationMessageId,
        message: message,
        keyboard: keyboard.inline()
      });

      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: `📋 Страница ${currentPage + 1}/${totalPages}`
        })
      });

    } catch (error) {
      logger.error('Ошибка при навигации по страницам:', error);
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Ошибка при навигации'
        })
      });
    }
    return;
  }

  // === Обработка кнопки закрытия меню редактирования ===
  if (eventPayload && eventPayload.command === 'close_edit_menu') {
    const { editor_id } = eventPayload;
    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.eventId; // Используем context.eventId напрямую
    const conversationMessageId = context.conversationMessageId || (context.object && context.object.conversation_message_id);

    if (actorId !== editor_id) {
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Только инициатор редактирования может закрыть меню'
        })
      });
      return;
    }

    try {
      await vk.api.messages.delete({
        peer_id: peerId,
        conversation_message_ids: conversationMessageId,
        delete_for_all: 1
      });

      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Редактирование завершено'
        })
      });
    } catch (error) {
      logger.error('Ошибка при закрытии меню редактирования:', error);
    }
    return;
  }

  // === Обработка кнопки "Снять роль" ===
  if (eventPayload && eventPayload.event_id === 9999) {
    const targetUserId = parseInt(eventPayload.target_user);
    const adminUserId = parseInt(eventPayload.admin_user);
    const actorId = context.userId;
    const peerId = context.peerId;
    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);
    
    const { getUserRole, getRoleName, checkIfTableExists } = require('./cmds/roles.js');
    const { checkCommandPriority } = require('./cmds/editcmd.js');
    const { getlink } = require('./util.js');
    const { addLog } = require('./utils/logs.js');

    try {
      // Проверяем, что таблица ролей существует
      if (!(await checkIfTableExists(`roles_${peerId}`))) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⚠️ Беседа не зарегистрирована'
          })
        });
        return;
      }

      // Проверяем права на снятие роли
      const hasPermission = await checkCommandPriority(peerId, actorId, '/role');
      if (!hasPermission) {
        const actorRole = await getUserRole(peerId, actorId);
        const actorRoleName = await getRoleName(peerId, actorRole);
        const actorLink = await getlink(actorId);
        
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: `⛔ Доступ запрещён | У ${actorLink} нет прав на снятие роли. Ваша роль: ${actorRoleName} (приоритет ${actorRole})`
          })
        });
        return;
      }

      // Получаем текущую роль пользователя
      const targetUserRole = await getUserRole(peerId, targetUserId);
      const actorRole = await getUserRole(peerId, actorId);
      
      // Проверяем, может ли актор снять роль с этого пользователя
      if (actorRole <= targetUserRole) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⛔ Вы не можете снять роль с пользователя с таким же или более высоким уровнем прав'
          })
        });
        return;
      }

      // Снимаем роль (устанавливаем приоритет 0)
      const rolesTable = `roles_${peerId}`;
      const query = `INSERT INTO ${rolesTable} (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`;

      database.query(query, [targetUserId, 0], async (error) => {
        if (error) {
          logger.error('Ошибка при снятии роли:', error);
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '❌ Произошла ошибка при снятии роли'
            })
          });
          return;
        }

        try {
          // Получаем кликабельные ссылки
          const targetLink = await getlink(targetUserId);
          const adminLink = await getlink(actorId);
          const previousRoleName = await getRoleName(peerId, targetUserRole);

          // Добавляем запись в журнал действий
          addLog(peerId, actorId, targetUserId, 'role', `Снята роль "${previousRoleName}", установлен приоритет 0`)
            .catch(err => logger.error('Ошибка при логировании снятия роли:', err));

          // Отправляем сообщение о снятии роли
          await vk.api.messages.send({
            peer_id: peerId,
            message: `✅ | У ${targetLink} снята роль "${previousRoleName}", установлен приоритет 0.\n\n👤 | Роль снял: ${adminLink}.`,
            random_id: Math.floor(Math.random() * 1000000)
          });

          // Отвечаем на callback
          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '✅ Роль снята'
            })
          });

        } catch (linkError) {
          logger.error('Ошибка при получении ссылок на пользователей:', linkError);
          
          // Добавляем запись в журнал действий
          addLog(peerId, actorId, targetUserId, 'role', 'Снята роль, установлен приоритет 0')
            .catch(err => logger.error('Ошибка при логировании снятия роли:', err));
          
          // Fallback с правильным форматом для сообществ
          const targetFallback = targetUserId < 0 ? `[club${Math.abs(targetUserId)}|Сообщество]` : `[id${targetUserId}|Пользователь]`;
          const adminFallback = `[id${actorId}|Администратор]`;
          
          await vk.api.messages.send({
            peer_id: peerId,
            message: `✅ | У ${targetFallback} снята роль, установлен приоритет 0.\n\n👤 | Роль снял: ${adminFallback}.`,
            random_id: Math.floor(Math.random() * 1000000)
          });

          await vk.api.messages.sendMessageEventAnswer({
            event_id: eventId,
            user_id: actorId,
            peer_id: peerId,
            event_data: JSON.stringify({
              type: 'show_snackbar',
              text: '✅ Роль снята'
            })
          });
        }
      });

    } catch (error) {
      logger.error('Ошибка при обработке кнопки снятия роли:', error);
      
      try {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Произошла ошибка'
          })
        });
      } catch (answerError) {
        logger.error('Ошибка при отправке ответа на callback:', answerError);
      }
    }
    return;
  }

  // === Обработка кнопки "Посмотреть" после активации бота ===
  if (eventPayload && eventPayload.command === 'show_settings') {
    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    try {
      // Проверяем права пользователя (приоритет 80+)
      const userRole = await getUserRole(peerId, actorId);
      
      if (userRole < 80) {
        // Отправляем snackbar с ошибкой
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⛔ Недостаточно прав для просмотра настроек'
          })
        });
        return;
      }

      // Находим команду settings и выполняем ее
      const settingsCommand = commands.find(cmd => cmd.command === '/settings');
      if (!settingsCommand) {
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '❌ Команда настроек не найдена'
          })
        });
        return;
      }

      // Создаем фейковый контекст для выполнения команды
      const fakeContext = {
        peerId: peerId,
        senderId: actorId,
        text: '/settings',
        messagePayload: null,
        send: (data) => {
          return vk.api.messages.send({
            peer_id: peerId,
            message: typeof data === 'string' ? data : data.message,
            keyboard: data.keyboard || null,
            random_id: Math.floor(Math.random() * 1000000)
          });
        },
        reply: (data) => {
          return vk.api.messages.send({
            peer_id: peerId,
            message: typeof data === 'string' ? data : data.message,
            keyboard: data.keyboard || null,
            random_id: Math.floor(Math.random() * 1000000)
          });
        }
      };

      await settingsCommand.execute(fakeContext);

      // Отвечаем на callback
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Настройки открыты'
        })
      });

    } catch (error) {
      logger.error('Ошибка при обработке кнопки настроек:', error);
      
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Произошла ошибка'
        })
      });
    }
  }

  // === Обработка кнопки "Посмотреть" для нарушений со ссылками ===
  if (eventPayload && eventPayload.command === 'view_link_violation') {
    const actorId = context.userId || (context.object && context.object.user_id);
    const peerId = context.peerId || (context.object && context.object.peer_id);
    const eventId = context.eventId || context.event_id || (context.object && context.object.event_id);

    try {
      // Проверяем права пользователя (приоритет 80+)
      const userRole = await getUserRole(peerId, actorId);
      
      if (userRole < 80) {
        // Отправляем snackbar с ошибкой
        await vk.api.messages.sendMessageEventAnswer({
          event_id: eventId,
          user_id: actorId,
          peer_id: peerId,
          event_data: JSON.stringify({
            type: 'show_snackbar',
            text: '⛔ Недостаточно прав для просмотра информации'
          })
        });
        return;
      }

      // Извлекаем данные о нарушении из payload
      const { user_id, user_name, links, time } = eventPayload;
      
      // Формируем сообщение для ЛС
      let violationMessage = `🚨 Информация о нарушении\n\n`;
      violationMessage += `👤 Нарушитель: [id${user_id}|${user_name}]\n`;
      violationMessage += `🕐 Время: ${time}\n`;
      violationMessage += `🔗 Отправленные ссылки:\n`;
      
      links.forEach((link, index) => {
        violationMessage += `${index + 1}. ${link}\n`;
      });

      // Отправляем сообщение в ЛС администратору
      await vk.api.messages.send({
        peer_id: actorId,
        message: violationMessage,
        random_id: Math.floor(Math.random() * 1000000)
      });

      // Отвечаем на callback
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '✅ Информация отправлена в ЛС'
        })
      });

    } catch (error) {
      logger.error('Ошибка при обработке кнопки просмотра нарушения:', error);
      
      await vk.api.messages.sendMessageEventAnswer({
        event_id: eventId,
        user_id: actorId,
        peer_id: peerId,
        event_data: JSON.stringify({
          type: 'show_snackbar',
          text: '❌ Произошла ошибка при отправке информации'
        })
      });
    }
    return;
  }

  function getAccessLevelName(level) {
    switch (level) {
      case 1: return 'Агент поддержки';
      case 2: return 'Администрация бота';
      case 3: return 'Заместитель основателя';
      case 4: return 'Основатель';
      case 5: return 'Разработчик';
      default: return 'Пользователь';
    }
  }
});
async function handleStartButton(context) {
  const { peerId, senderId } = context;
  const conferenceId = peerId;

  try {
    const conversationInfo = await vk.api.messages.getConversationMembers({
      peer_id: peerId,
    });

    if (
      !conversationInfo ||
      !conversationInfo.items ||
      !Array.isArray(conversationInfo.items)
    ) {
      return context.send(
        "❌ Упс... Кажется Вы не выдали мне права администратора!"
      );
    }

    // Находим информацию о текущем пользователе
    const currentUserInfo = conversationInfo.items.find(
      (item) => item.member_id === senderId
    );

    logger.log('Информация о пользователе:', currentUserInfo);

    // Проверяем, является ли пользователь владельцем или администратором (звездой)
    const isAdmin = currentUserInfo && (currentUserInfo.is_admin || currentUserInfo.is_owner);

    if (!isAdmin) {
      return context.send("❌ Только администратор чата (звезда) может активировать бота.");
    }
  } catch (error) {
    logger.error('Ошибка при получении информации о беседе:', error);
    return context.send('❌ Ошибка | Произошла ошибка при проверке прав администратора');
  }

  // Проверяем, не активирована ли уже беседа
  const checkConferenceQuery = "SELECT * FROM conference WHERE conference_id = ?";
  try {
    const conferenceResults = await new Promise((resolve, reject) => {
      database.query(checkConferenceQuery, [conferenceId], (error, results) => {
        if (error) {
          logger.error('Ошибка при проверке активации беседы:', error);
          reject(error);
        } else {
          resolve(results);
        }
      });
    });

    if (conferenceResults && conferenceResults.length > 0) {
      return context.send('⚠️ Внимание | Беседа уже активирована в системе управления');
    }
  } catch (error) {
    logger.error('Ошибка при проверке активации беседы:', error);
    return context.send('❌ Ошибка | Произошла ошибка при проверке активации беседы');
  }

  const conferenceTableQuery = `
    CREATE TABLE IF NOT EXISTS conference (
      conference_id INT PRIMARY KEY,
      games INT DEFAULT 0,
      uniquekey TEXT,
      hello_text TEXT
    )
  `;

  let popa = generateUniqueKey();

  database.query(conferenceTableQuery, async (error) => {
    if (error) {
      logger.error("Ошибка при создании таблицы conference:", error);
      return context.send("Произошла ошибка.");
    }

    // Создаем объект данных для новой беседы
    const newConferenceData = {
      conference_id: conferenceId,
      uniquekey: popa,
    };

    const nicknamesTableQuery = `
    CREATE TABLE IF NOT EXISTS nicknames_${conferenceId} (
      user_id INT PRIMARY KEY,
      nickname VARCHAR(255)
    )
    `;

    database.query(nicknamesTableQuery, async (error) => {
      if (error) {
        logger.error("Ошибка при создании таблицы ролей:", error);
        return context.send("Произошла ошибка.");
      }

      const insertConferenceQuery = "INSERT INTO conference SET ?";
      database.query(
        insertConferenceQuery,
        newConferenceData,
        async (error, result) => {
          if (error) {
            logger.error(
              "Ошибка при вставке данных в базу данных:",
              error
            );
            return context.send("Произошла ошибка.");
          }

          // Создаем таблицу для конференции
          const conferenceTableQuery = `
          CREATE TABLE IF NOT EXISTS conference_${conferenceId} (
            user_id INT PRIMARY KEY,
            messages_count INT,
            coins INT,
            blocked_users TEXT,
            warns INT,
            warns_history TEXT,
            chat_block BOOLEAN
          )
        `;

          database.query(conferenceTableQuery, async (error) => {
            if (error) {
              logger.error("Ошибка при создании таблицы беседы:", error);
              return context.send("Произошла ошибка.");
            }

            const rolesTableQuery = `
          CREATE TABLE IF NOT EXISTS roles_${conferenceId} (
            user_id INT PRIMARY KEY,
            role_id INT
          )
        `;

            database.query(rolesTableQuery, async (error) => {
              if (error) {
                logger.error("Ошибка при создании таблицы ролей:", error);
                return context.send("Произошла ошибка.");
              }

              // Назначаем роль владельца
              const insertRoleQuery = `
            INSERT INTO roles_${conferenceId} (user_id, role_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
          `;

              // Назначаем владельца
              database.query(
                insertRoleQuery,
                [senderId, 100],
                (error, result) => {
                  if (error) {
                    logger.error(
                      'Ошибка при назначении роли "Владелец":',
                      error
                    );
                    return context.send("Произошла ошибка на роли.");
                  }

                  const { Keyboard } = require('vk-io');
                  
                  const activationKeyboard = Keyboard.builder()
                    .callbackButton({
                      label: 'Настроить',
                      payload: {
                        command: 'show_settings'
                      },
                      color: Keyboard.NEGATIVE_COLOR
                    })
                    .inline();

                  context.send({
                    message: `🌃 Чудесно, теперь я могу управлять беседой!\n\n🔨 Настройте чат командой: /settings\n✨ Уникальный код чата: #${popa} (в случае проблем, отпишите Администратору - указав этот код)\n\n🛡️ Cистемы защиты от флуда и слива чата автоматически настроены и включены.`,
                    keyboard: activationKeyboard
                  });
                }
              );
            });
          });
        }
      );
    });
  });
}

async function setChatTitle(peerId, newTitle) {
  try {
    await vk.api.messages.editChat({
      chat_id: peerId - 2000000000,
      title: newTitle,
    });

    logger.log("Название беседы успешно изменено.");
  } catch (error) {
    logger.error("Ошибка при изменении названия беседы:", error);
  }
}

global.setChatTitle = setChatTitle;

function generateRandom32BitNumber() {
  return Math.floor(Math.random() * Math.pow(2, 32));
}
global.generateRandom32BitNumber = generateRandom32BitNumber;
vk.updates.on("chat_invite_user", async (context) => {
  const { peerId, eventMemberId } = context;

  // Подробное логирование события добавления участника
  logger.log(`🔍 Событие chat_invite_user: peerId=${peerId}, eventMemberId=${eventMemberId}, senderId=${context.senderId}`);

  if (eventMemberId < 0) {
    logger.log(`🤖 Добавлено сообщество/бот с ID: ${eventMemberId}`);
  } else {
    logger.log(`👤 Добавлен пользователь с ID: ${eventMemberId}`);
  }

  // === УВЕДОМЛЕНИЕ О ДОБАВЛЕНИИ БОТА В НОВЫЙ ЧАТ ===
  try {
    const currentBotId = await getBotId();
    if (currentBotId && eventMemberId === currentBotId) {
      // Наш бот был добавлен в новый чат - отправляем уведомление
      try {
        await vk.api.messages.send({
          peer_id: 2000000087,
          message: `@all ✅ бот был добавлен в новый чат\n❓ ID чата: ${peerId}`,
          random_id: Math.floor(Math.random() * 1000000)
        });
        
        logger.log(`✅ Отправлено уведомление о добавлении бота в чат ${peerId}`);
      } catch (notifyError) {
        logger.error('❌ Ошибка отправки уведомления о добавлении бота:', notifyError);
      }
    }
  } catch (botIdError) {
    logger.error('❌ Ошибка получения ID бота для уведомления:', botIdError);
  }

  try {
    // Проверяем, является ли добавленный пользователь группой/сообществом (отрицательный ID)
    if (eventMemberId < 0) {
      // Это логирование уже есть выше, удаляем дублирование

      // Проверяем настройки запрета групп
      const userRole = await getUserRole(context.peerId, context.senderId);
      if (userRole < 20) {
        try {
          const settings = await getChatSettingsOptimized(context.peerId);
          const groups = settings && settings.groups ? settings.groups : 0;

          if (groups === 1) {
            try {
              // Получаем информацию о пользователе
              const userInfo = await vk.api.users.get({ user_ids: [context.senderId] });
              const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'пользователь';

              // Получаем информацию о группе
              let groupName = 'сообщество';
              try {
                const groupInfo = await vk.api.groups.getById({ group_id: Math.abs(eventMemberId) });
                if (groupInfo && groupInfo[0]) {
                  groupName = groupInfo[0].name;
                }
              } catch (groupError) {
                logger.error('Ошибка при получении информации о группе:', groupError);
              }

              // Исключаем группу из чата
              await vk.api.messages.removeChatUser({
                chat_id: peerId - 2000000000,
                member_id: eventMemberId,
              });

              // Отправляем сообщение с информацией о запрете
              return context.send(
                `⛔ [id${context.senderId}|${userName}] пытался добавить сообщество "${groupName}" в чат, но это запрещено настройками.\n\n📝 Эту настройку можно отключить командой: /settings groups 0`
              );
            } catch (kickError) {
              logger.error('Ошибка при исключении сообщества из чата:', kickError);
              return context.send(
                `⚠️ Не удалось исключить сообщество из чата. Проверьте права бота.`
              );
            }
          }
        } catch (error) {
          logger.error('Ошибка при проверке настроек групп:', error);
        }
      }

      // СНАЧАЛА проверяем, не заблокировано ли это сообщество
      const getUserBanQuery = `
        SELECT blocked_users
        FROM conference_${peerId}
        WHERE user_id = ?
      `;

      try {
        const banResults = await databaseQuery(getUserBanQuery, [eventMemberId]);
        const { blocked_users } = banResults && banResults[0] ? banResults[0] : {};

        if (blocked_users) {
          let jsonString;
          try {
            if (blocked_users && blocked_users.trim() !== '') {
              jsonString = JSON.parse(blocked_users);
            } else {
              jsonString = [];
            }
          } catch (error) {
            logger.error('ERROR: Failed to parse blocked_users JSON:', error);
            jsonString = [];
          }

          if (jsonString && jsonString.length > 0) {
            const userBlock = jsonString.find(block => {
              const blockedId = parseInt(block.blocked_user_id);
              const memberId = parseInt(eventMemberId);
              logger.log(`🔍 Проверка блокировки сообщества: blockedId=${blockedId}, memberId=${memberId}`);
              return blockedId === memberId;
            });

            if (userBlock) {
              let banchel = await utils.getlink(userBlock.blocked_by);
              let dateObject = new Date(userBlock.block_until);

              let formattedDate =
                dateObject.getDate() +
                " " +
                monthName(dateObject.getMonth()) +
                " " +
                dateObject.getFullYear() +
                " года";

              await context.send({
                message: `⛔ ${await utils.getlink(eventMemberId)} заблокировано в этом чате:\n\nПричина: ${userBlock.reason}\nЗаблокировал: ${banchel}\nДата разблокировки: ${formattedDate}`,
                disable_mentions: true,
              });

              try {
                await vk.api.messages.removeChatUser({
                  chat_id: peerId - 2000000000,
                  member_id: eventMemberId,
                });
                logger.log(`✅ Заблокированное сообщество ${eventMemberId} исключено из чата`);
              } catch (kickError) {
                logger.error('Ошибка при исключении заблокированного сообщества:', kickError);
              }
              return; // Прекращаем обработку, так как сообщество заблокировано
            }
          }
        }
      } catch (error) {
        logger.error('Ошибка при проверке блокировки сообщества:', error);
      }

      // Проверяем, является ли добавленное сообщество нашим ботом
      const currentBotId = await getBotId();

      if (!currentBotId) {
        console.warn(`⚠️ Не удалось получить ID бота, пропускаем проверку для сообщества ${eventMemberId}`);
        return; // Не отправляем приветственное сообщение, если не знаем ID бота
      }

      if (eventMemberId === currentBotId) {
        logger.log(`✅ Обнаружено добавление нашего бота (ID: ${eventMemberId}) в чат ${peerId}`);

        const buttonPayload = {
          button: "start",
          event_id: 51898,
        };

        const keyboard = Keyboard.builder()
          .textButton({
            label: "Активировать",
            payload: JSON.stringify(buttonPayload),
            inline: true,
            color: Keyboard.PRIMARY_COLOR,
          })
          .inline();

        const fmsg =
          "💞 Спасибо за добавление :3\n\n⚙ Для полноценной работы бота, нужно нажать на название беседы и кликнуть по кнопке «Назначить администратором» возле бота\n\n📝 Команды бота: /help\n📖 Руководство: В данный момент не доступно";

        // Отправляем приветственное сообщение только для нашего бота
        try {
          await context.send({ message: fmsg, keyboard: keyboard });
          logger.log(`✅ Приветственное сообщение отправлено в чат ${peerId}`);
        } catch (sendError) {
          logger.error('Ошибка при отправке приветственного сообщения:', sendError);
        }
      } else {
        logger.log(`ℹ️ Добавлено другое сообщество (ID: ${eventMemberId}), приветственное сообщение не отправляется`);
      }
    } else {
      const getUserRoleQuery = `
        SELECT hello_text, public
        FROM conference
        WHERE conference_id = ?
      `;

      const getUserBanQuery = `
        SELECT blocked_users
        FROM conference_${peerId}
        WHERE user_id = ?
      `;
      database.query(getUserRoleQuery, [peerId], async (error, results) => {
        if (error) {
          logger.error("Ошибка при получении данных беседы:", error);
          return;
        }


        const ress = await databaseQuery(getUserBanQuery, [eventMemberId]);
        const { hello_text: helloText, public: groupLink } =
          results && results[0] ? results[0] : {};
        const { blocked_users } = ress && ress[0] ? ress[0] : {};
        if (blocked_users) {
          let jsonString;
          try {
            // Проверяем, что blocked_users не пустая строка и не null
            if (blocked_users && blocked_users.trim() !== '') {
              jsonString = JSON.parse(blocked_users);
            } else {
              logger.log('DEBUG: blocked_users is empty or null, using empty array');
              jsonString = [];
            }
          } catch (error) {
            logger.error('ERROR: Failed to parse blocked_users JSON:', error);
            logger.error('DEBUG: blocked_users content:', blocked_users);
            jsonString = []; // Используем пустой массив в случае ошибки
          }

          if (jsonString && jsonString.length > 0) {
            // Ищем конкретного пользователя/сообщество в списке заблокированных
            const userBlock = jsonString.find(block => {
              const blockedId = parseInt(block.blocked_user_id);
              const memberId = parseInt(eventMemberId);
              logger.log(`🔍 Проверка блокировки: blockedId=${blockedId}, memberId=${memberId}`);
              return blockedId === memberId;
            });

            if (userBlock) {
              let banchel = await getlink(userBlock.blocked_by);
              let dateObject = new Date(userBlock.block_until);

              let formattedDate =
                dateObject.getDate() +
                " " +
                monthName(dateObject.getMonth()) +
                " " +
                dateObject.getFullYear() +
                " года";

              await context.send({
                message: `⛔ ${await utils.getlink(eventMemberId)} заблокирован в этом чате:\n\nПричина: ${userBlock.reason}\nЗаблокировал: ${banchel}\nДата разблокировки: ${formattedDate}`,
                disable_mentions: true,
              });
              try {
                await vk.api.messages.removeChatUser({
                  chat_id: peerId - 2000000000,
                  member_id: eventMemberId,
                });
              } catch (kickError) {
                logger.error('Ошибка при исключении заблокированного пользователя:', kickError);
              }
              return;
            }
          }
        }
        if (groupLink && groupLink.length > 0) {

          try {
            const groupId = parseInt(
              groupLink.substring(groupLink.lastIndexOf("|") + 1),
              10
            );


            const isMemberResponse = await vk.api.groups.isMember({
              group_id: groupId,
              user_id: eventMemberId,
            });

            if (!isMemberResponse) {
              await context.send(
                `⛔ Приглашенный участник должен состоять в [club${groupId}|сообществе]. Пользователь был удален из беседы.`
              );
              try {
                await vk.api.messages.removeChatUser({
                  chat_id: peerId - 2000000000,
                  member_id: eventMemberId,
                });
              } catch (kickError) {
                logger.error('Ошибка при исключении пользователя без подписки на группу:', kickError);
              }

              return;
            }
          } catch (error) {
            logger.error("Ошибка при проверке участия в группе:", error);
            return;
          }
        }


        if (helloText && helloText.trim() !== '') {
          const namechela = await getlink(eventMemberId);
          await context.send(`${namechela}, ${helloText}`);
        }
      });
    }
  } catch (error) {
    logger.error("Ошибка при обработке события chat_invite_user:", error);
  }
});

const startDate = new Date();

global.startDate = startDate;
vk.updates.start().catch(logger.error);

setInterval(() => {
  const currentDate = new Date();

  // Проверка мута пользователей
  for (const conferenceId in mutedUsersInfo) {
    const mutedUsersForConference = mutedUsersInfo[conferenceId];

    for (const numericId in mutedUsersForConference) {
      const muteInfo = mutedUsersForConference[numericId];
      const muteUntil = new Date(muteInfo.mute_until);

      if (currentDate >= muteUntil) {
        delete mutedUsersForConference[numericId];

        const message = `⚠ У [id${numericId}|Пользователя] закончилась блокировка чата.`;

        vk.api.messages.send({
          peer_id: conferenceId,
          message: message,
          random_id: Date.now(),
        });
      }
    }
  }

  // Проверка режима тишины
  for (const peerId in silenceConf) {
    const silenceInfo = silenceConf[peerId];
    if (silenceInfo.silence && silenceInfo.muteUntil) {
      const muteUntil = new Date(silenceInfo.muteUntil);

      if (currentDate >= muteUntil) {
        // Отключаем режим тишины
        silenceInfo.silence = 0;
        delete silenceInfo.muteUntil;

        const message = `❗ Режим тишины автоматически отключен по истечении времени.`;

        vk.api.messages.send({
          peer_id: peerId,
          message: message,
          random_id: Date.now(),
        });
      }
    }
  }
}, 1000);

setInterval(async () => {
  const currentDate = new Date();

  try {

    const selectAllConferenceIdsQuery = `
      SELECT conference_id
      FROM conference
    `;

    const conferenceRows = await databaseQuery(selectAllConferenceIdsQuery);

    for (const { conference_id } of conferenceRows) {

      const selectBlockedUsersQuery = `
        SELECT user_id, blocked_users
        FROM conference_${conference_id}
        WHERE blocked_users IS NOT NULL AND blocked_users != '[]'
      `;

      try {
        const blockResults = await databaseQuery(selectBlockedUsersQuery);

        if (!blockResults || !Array.isArray(blockResults)) {
          logger.log(`Нет заблокированных пользователей для конференции ${conference_id}`);
          continue;
        }

        for (const blockResult of blockResults) {
          if (blockResult && blockResult.blocked_users) {
            let blockedUsers;
            try {
              // Если строка пустая, используем пустой массив
              if (!blockResult.blocked_users || blockResult.blocked_users.trim() === '') {
                blockedUsers = [];
              } else {
                blockedUsers = JSON.parse(blockResult.blocked_users);
              }
            } catch (parseError) {
              // При ошибке парсинга инициализируем пустым массивом
              blockedUsers = [];
              // Обновляем запись в БД с пустым массивом
              const updateQuery = `UPDATE conference_${conference_id} SET blocked_users = '[]' WHERE user_id = ?`;
              database.query(updateQuery, [blockResult.user_id], (err) => {
                if (!err) {
                  logger.log(`Восстановлена структура blocked_users для пользователя ${blockResult.user_id} в конференции ${conference_id}`);
                }
              });
              continue;
            }

            if (blockedUsers && Array.isArray(blockedUsers) && blockedUsers.length > 0) {
              const updatedBlockedUsers = [];

              for (const block of blockedUsers) {
                if (block && block.blocked_user_id && block.block_until) {
                  const { blocked_user_id, block_until } = block;
                  const blockUntilDate = new Date(block_until);

                  if (currentDate >= blockUntilDate) {
                    // Бан истек, удаляем его
                    const message = `⚠ У [id${blocked_user_id}|Пользователя] закончилась блокировка.`;

                    try {
                      await vk.api.messages.send({
                        peer_id: conference_id,
                        message: message,
                        random_id: Date.now(),
                      });
                    } catch (sendError) {
                      logger.error(`Ошибка при отправке сообщения о разблокировке в ${conference_id}:`, sendError);
                    }
                  } else {
                    // Бан еще действует, оставляем его
                    updatedBlockedUsers.push(block);
                  }
                }
              }

              // Обновляем список заблокированных пользователей
              const updateBlockedUsersQuery = `
                UPDATE conference_${conference_id}
                SET blocked_users = ?
                WHERE user_id = ?
              `;

              const updatedBlockedUsersJSON = updatedBlockedUsers.length
                ? JSON.stringify(updatedBlockedUsers)
                : null;

              try {
                await databaseQuery(updateBlockedUsersQuery, [
                  updatedBlockedUsersJSON,
                  blockResult.user_id,
                ]);
              } catch (updateError) {
                logger.error(`Ошибка при обновлении blocked_users для ${conference_id}:`, updateError);
              }
            }
          }
        }
      } catch (queryError) {
        logger.error(`Ошибка при запросе заблокированных пользователей для ${conference_id}:`, queryError);
      }
    }
  } catch (error) {
    logger.error("Ошибка при проверке блокировок:", error);
  }
}, 1000);

vk.updates.on("chat_kick_user", async (context) => {
  const { eventMemberId, senderId, peerId } = context;

  if (eventMemberId === senderId) {
    // Пользователь вышел добровольно
    try {
      // Получаем информацию о пользователе и определяем пол
      let userName = `[id${eventMemberId}|Участник]`;
      let exitMessage = 'вышел(а)';
      try {
        const userInfo = await vk.api.users.get({ user_ids: eventMemberId, fields: 'sex' });
        if (userInfo && userInfo[0]) {
          userName = `[id${eventMemberId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
          // Определяем правильное склонение по полу (1 - женский, 2 - мужской)
          if (userInfo[0].sex === 1) {
            exitMessage = 'вышла';
          } else if (userInfo[0].sex === 2) {
            exitMessage = 'вышел';
          } else {
            exitMessage = 'вышел(а)'; // Если пол не определен
          }
        }
      } catch (error) {
        logger.error('Ошибка при получении информации о пользователе:', error);
      }

      // Проверяем настройку kick_leave
      const getKickLeaveQuery = `
        SELECT kick_leave
        FROM conference
        WHERE conference_id = ?
      `;

      const [rows] = await queryAsync(getKickLeaveQuery, [peerId]);
      const kickLeaveValue = rows ? rows.kick_leave : 0;
      
      if (kickLeaveValue === 1) {
        // Если настройка включена - просто кикаем без сообщения
        try {
          await vk.api.messages.removeChatUser({
            chat_id: peerId - 2000000000,
            member_id: eventMemberId,
          });
        } catch (kickError) {
          logger.error('Ошибка при исключении пользователя при kick_leave:', kickError);
        }
      } else {
        // Если настройка выключена - показываем сообщение с кнопкой "Исключить"
        const keyboard = Keyboard.builder()
          .callbackButton({
            label: "Исключить",
            payload: {
              command: "exclude_user",
              user_id: eventMemberId,
              event_id: 7777
            },
            color: Keyboard.NEGATIVE_COLOR
          })
          .inline();

        // Отправляем сообщение
        await vk.api.messages.send({
          peer_id: peerId,
          message: `${userName} ${exitMessage} из чата`,
          keyboard: keyboard,
          random_id: Date.now()
        });
      }
    } catch (error) {
      logger.error(
        "Ошибка при обработке добровольного выхода пользователя:",
        error
      );
    }
  }
});

function monthName(month) {
  var monthNames = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  return monthNames[month];
}

// Функция для очистки некорректных записей с null в blocked_users
async function cleanupBlockedUsers() {
  try {
    const selectAllConferenceIdsQuery = `
      SELECT conference_id
      FROM conference
    `;

    const conferenceRows = await databaseQuery(selectAllConferenceIdsQuery);

    for (const { conference_id } of conferenceRows) {
      try {
        // Получаем все записи с blocked_users
        const selectAllQuery = `
          SELECT user_id, blocked_users
          FROM conference_${conference_id}
          WHERE blocked_users IS NOT NULL
        `;

        const results = await databaseQuery(selectAllQuery);

        for (const result of results) {
          if (!result.blocked_users) continue;

          try {
            let blockedUsers;
            // Проверяем на пустую строку перед парсингом
            if (!result.blocked_users || result.blocked_users.trim() === '') {
              blockedUsers = [];
            } else {
              blockedUsers = JSON.parse(result.blocked_users);
            }
            if (!Array.isArray(blockedUsers)) {
              // Если это не массив, инициализируем пустым массивом
              blockedUsers = [];
              const updateQuery = `UPDATE conference_${conference_id} SET blocked_users = '[]' WHERE user_id = ?`;
              await databaseQuery(updateQuery, [result.user_id]);
              logger.log(`Восстановлена структура blocked_users для пользователя ${result.user_id} в конференции ${conference_id}`);
              continue;
            }

            // Проверяем наличие null в blocked_user_id
            const hasNullIds = blockedUsers.some(block => block.blocked_user_id === null || block.blocked_user_id === undefined);

            if (hasNullIds) {
              // Удаляем записи с null
              const cleanedBlockedUsers = blockedUsers.filter(block => block.blocked_user_id !== null && block.blocked_user_id !== undefined);

              // Обновляем запись
              const updateQuery = `
                UPDATE conference_${conference_id}
                SET blocked_users = ?
                WHERE user_id = ?
              `;

              await databaseQuery(updateQuery, [
                JSON.stringify(cleanedBlockedUsers),
                result.user_id
              ]);

              logger.log(`Очищены некорректные записи с null в blocked_users для пользователя ${result.user_id} в конференции ${conference_id}`);
            }
          } catch (parseError) {
            logger.error(`Ошибка при парсинге blocked_users для ${conference_id}:`, parseError);
          }
        }
      } catch (error) {
        logger.error(`Ошибка при очистке blocked_users для конференции ${conference_id}:`, error);
      }
    }
  } catch (error) {
    logger.error("Ошибка при очистке некорректных записей:", error);
  }
}

// Запускаем очистку при старте бота
cleanupBlockedUsers().catch(logger.error);

// Функция обработки callback'ов игры в слова
async function handleWordsCallback(context, payload, wordsModule) {
  const peerId = context.peerId;
  const userId = context.senderId;
  const gameState = wordsModule.activeGames.get(peerId);
  
  try {
    switch (payload.action) {
      case 'join_game':
        if (!gameState) {
          await context.send('❌ Сейчас не идёт игра в слова. Используйте /words для создания новой игры.');
          return;
        }
        
        if (gameState.status === 'playing') {
          await context.send('❌ Игра уже идёт. Дождитесь окончания текущей игры.');
          return;
        }
        
        if (gameState.players.includes(userId)) {
          await context.send('❌ Вы уже участвуете в игре.');
          return;
        }
        
        gameState.players.push(userId);
        const userName = await wordsModule.getUserName(userId);
        
        if (gameState.players.length >= 2) {
          // Очищаем таймер ожидания
          if (gameState.waitingTimeoutId) {
            clearTimeout(gameState.waitingTimeoutId);
            gameState.waitingTimeoutId = null;
          }
          
          gameState.status = 'playing';
          const randomPlayerIndex = Math.floor(Math.random() * gameState.players.length);
          gameState.currentPlayer = gameState.players[randomPlayerIndex];
          
          const firstPlayerName = await wordsModule.getUserName(gameState.currentPlayer);
          const message = `🎮 Игра в слова началась!\n\n💬 ${firstPlayerName} говорит первое слово. У него 60 секунд.`;
          
          await context.send({
            message: message,
            keyboard: wordsModule.createGameKeyboard(gameState)
          });
        } else {
          const message = `✅ ${userName} присоединился к игре! Ожидаем ещё игроков.`;
          await context.send({
            message: message,
            keyboard: wordsModule.createGameKeyboard(gameState)
          });
        }
        break;
        
      case 'leave_game':
        if (!gameState || !gameState.players.includes(userId)) {
          await context.send('❌ Вы не участвуете в игре.');
          return;
        }
        
        gameState.players = gameState.players.filter(p => p !== userId);
        const leavingUserName = await wordsModule.getUserName(userId);
        
        if (gameState.players.length < 2 && gameState.status === 'playing') {
          gameState.status = 'finished';
          let message = `🔩 ${leavingUserName} покинул игру. Игра была закончена, было сказано ${gameState.wordCount} слов.`;
          
          if (gameState.players.length === 1) {
            const winnerId = gameState.players[0];
            const winnerName = await wordsModule.getUserName(winnerId);
            message += `\n\n🏆 Победитель игры: ${winnerName}.`;
            
            // Обновляем статистику игры в слова для победителя
            try {
              const { updateGameStats } = require('./cmds/top.js');
              await updateGameStats(winnerId, 'words', true);
              logger.log(`Обновлена статистика игры в слова для победителя ${winnerId}`);
            } catch (error) {
              logger.error('Ошибка при обновлении статистики игры в слова:', error);
            }
          }
          
          await context.send({
            message: message,
            keyboard: wordsModule.createGameKeyboard(gameState)
          });
        } else {
          await context.send(`❌ ${leavingUserName} покинул игру.`);
        }
        break;
        
      case 'stop_game':
        if (!gameState) {
          await context.send('❌ Сейчас не идёт игра в слова.');
          return;
        }
        
        if (userId !== gameState.creator) {
          await context.send('❌ Остановить игру может только её создатель.');
          return;
        }
        
        // Очищаем таймер ожидания, если он есть
        if (gameState.waitingTimeoutId) {
          clearTimeout(gameState.waitingTimeoutId);
        }
        if (gameState.timeoutId) {
          clearTimeout(gameState.timeoutId);
        }
        
        // Меняем статус на finished и показываем кнопки
        gameState.status = 'finished';
        const creatorName = await wordsModule.getUserName(userId);
        
        await context.send({
          message: `🚨 ${creatorName} остановил игру.`,
          keyboard: wordsModule.createGameKeyboard(gameState)
        });
        break;
        
      case 'show_rules':
        const rulesUserName = await wordsModule.getUserName(userId);
        const rulesMessage = `📒 ${rulesUserName}, правила игры «слова»: игроки должны по очереди говорить слова на последнюю букву предыдущего слова, и так до тех пор, пока игрок не сможет вспомнить слово за определенное время, он проиграет.`;
        await context.send(rulesMessage);
        break;
        
      case 'start_new_game':
        wordsModule.activeGames.delete(peerId);
        
        const newGame = {
          status: 'waiting',
          players: [userId],
          creator: userId,
          usedWords: new Set(),
          wordCount: 0,
          lastLetter: null,
          currentPlayer: null,
          timeoutId: null,
          waitingTimeoutId: null
        };
        
        wordsModule.activeGames.set(peerId, newGame);
        
        // Запускаем таймер ожидания (5 минут)
        newGame.waitingTimeoutId = setTimeout(async () => {
          const currentGame = wordsModule.activeGames.get(peerId);
          if (currentGame && currentGame.status === 'waiting' && currentGame.players.length < 2) {
            currentGame.status = 'finished';
            const creatorName = await wordsModule.getUserName(currentGame.creator);
            
            await vk.api.messages.send({
              peer_id: peerId,
              message: `⏰ Игра автоматически остановлена - никто не присоединился за 5 минут. Создатель: ${creatorName}`,
              keyboard: wordsModule.createGameKeyboard(currentGame),
              random_id: Math.floor(Math.random() * 1000000)
            });
          }
        }, 5 * 60 * 1000); // 5 минут
        
        const newGameCreatorName = await wordsModule.getUserName(userId);
        const message = `💭 ${newGameCreatorName} запустил игру: «слова». Нужно собрать ещё как минимум одного игрока.`;
        
        await context.send({
          message: message,
          keyboard: wordsModule.createGameKeyboard(newGame)
        });
        break;
    }
  } catch (error) {
    logger.error('Ошибка в handleWordsCallback:', error);
    await context.reply('❌ Произошла ошибка при обработке игры в слова.');
  }
}

// Функция запуска таймера для игрока
function startPlayerTimeout(gameState, peerId, wordsModule) {
  gameState.timeoutId = setTimeout(async () => {
    const currentGame = wordsModule.activeGames.get(peerId);
    if (!currentGame || currentGame.status !== 'playing') {
      return;
    }
    
    try {
      const playerName = await wordsModule.getUserName(currentGame.currentPlayer);
      currentGame.players = currentGame.players.filter(p => p !== currentGame.currentPlayer);
      
      if (currentGame.players.length <= 1) {
        currentGame.status = 'finished';
        let message = `🔩 ${playerName} ничего не сказал и был исключён из игры. Игра была закончена, было сказано ${currentGame.wordCount} слов.`;
        
        if (currentGame.players.length === 1) {
          const winnerId = currentGame.players[0];
          const winnerName = await wordsModule.getUserName(winnerId);
          message += `\n\n🏆 Победитель игры: ${winnerName}.`;
          
          // Обновляем статистику игры в слова для победителя
          try {
            const { updateGameStats } = require('./cmds/top.js');
            await updateGameStats(winnerId, 'words', true);
            logger.log(`Обновлена статистика игры в слова для победителя ${winnerId} (по таймауту)`);
          } catch (error) {
            logger.error('Ошибка при обновлении статистики игры в слова:', error);
          }
        }
        
        await vk.api.messages.send({
          peer_id: peerId,
          message: message,
          keyboard: wordsModule.createGameKeyboard(currentGame),
          random_id: Math.floor(Math.random() * 1000000)
        });
      } else {
        const nextPlayerIndex = Math.floor(Math.random() * currentGame.players.length);
        currentGame.currentPlayer = currentGame.players[nextPlayerIndex];
        
        const nextPlayerName = await wordsModule.getUserName(currentGame.currentPlayer);
        const message = `🔩 ${playerName} исключён за неактивность.\n\n💬 ${nextPlayerName} говорит слово на «${currentGame.lastLetter ? currentGame.lastLetter.toUpperCase() : 'любую'}».`;
        
        await vk.api.messages.send({
          peer_id: peerId,
          message: message,
          keyboard: wordsModule.createGameKeyboard(currentGame),
          random_id: Math.floor(Math.random() * 1000000)
        });
        
        startPlayerTimeout(currentGame, peerId, wordsModule);
      }
    } catch (error) {
      logger.error('Ошибка в таймере игры:', error);
    }
  }, 60000);
}

// === Функция для запуска интерактивного сценария полёта ===
async function startFlightScenario(userId, peerId, flight) {
  const { getlink } = require('./util.js');
  const { completeFlight } = require('./pilotManager.js');
  const { getUserBalance, updateUserBalance } = require('./filedb.js');
  
  // Сохраняем состояние полёта для пользователя
  if (!global.activeFlights) {
    global.activeFlights = new Map();
  }
  
  global.activeFlights.set(userId, {
    peerId: peerId,
    flight: flight,
    stage: 'preflight',
    score: 100, // Начальный счёт безопасности
    decisions: []
  });
  
  // Этап 1: Предполётная подготовка
  await startPreflightStage(userId, peerId, flight);
}

// === Этап 1: Предполётная подготовка ===
async function startPreflightStage(userId, peerId, flight) {
  const { getlink } = require('./util.js');
  const pilotName = await getlink(userId);
  
  const response = await vk.api.messages.send({
    peer_id: peerId,
    message: `✈️ Добро пожаловать на борт, капитан ${pilotName}!\n\n📋 Предполётная подготовка:\n🌤️ Погода: переменная облачность, ветер 15 км/ч\n🛩️ Самолёт: ${flight.aircraft.name}\n🎯 Пункт назначения: ${flight.destination.city}\n\n⚠️ ВНИМАНИЕ: Метеослужба сообщает о возможной грозе на маршруте через 2 часа.\n\n🎯 Выберите действие:`,
    keyboard: JSON.stringify({
      inline: true,
      buttons: [
        [{
          action: {
            type: 'callback',
            payload: JSON.stringify({ event_id: 9100, user_id: userId }),
            label: '🛫 Взлетать сейчас'
          },
          color: 'primary'
        }],
        [{
          action: {
            type: 'callback',
            payload: JSON.stringify({ event_id: 9101, user_id: userId }),
            label: '⏰ Подождать улучшения погоды'
          },
          color: 'secondary'
        }]
      ]
    }),
    random_id: Math.floor(Math.random() * 1000000)
  });
  
  // Сохраняем ID сообщения для дальнейшего редактирования
  const flightData = global.activeFlights.get(userId);
  if (flightData) {
    flightData.messageId = response.conversation_message_id;
  }
}

// === Этап 2: Взлёт ===
async function startTakeoffStage(userId, peerId, decision) {
  const flightData = global.activeFlights.get(userId);
  if (!flightData) return;
  
  flightData.stage = 'takeoff';
  flightData.decisions.push(decision);
  
  let message = '';
  let scoreChange = 0;
  
  if (decision === 'takeoff_now') {
    message = '🚀 Взлёт выполнен в сложных условиях\n⚠️ Турбулентность при наборе высоты\n\n📡 Диспетчер: "Рейс, внимание! Впереди зона грозовой активности"\n\n⏳ Переход к крейсерскому полёту...';
    scoreChange = -10;
  } else {
    message = '⏰ Ожидание завершено\n☀️ Погода улучшилась\n🚀 Взлёт выполнен в отличных условиях\n\n⏳ Переход к крейсерскому полёту...';
    scoreChange = +10;
  }
  
  flightData.score += scoreChange;
  
  // Редактируем существующее сообщение
  try {
    await vk.api.messages.edit({
      peer_id: peerId,
      conversation_message_id: flightData.messageId,
      message: message
    });
  } catch (error) {
    logger.error('Ошибка при редактировании сообщения взлёта:', error);
  }
  
  // Задержка перед следующим этапом
  setTimeout(() => {
    startCruiseStage(userId, peerId);
  }, 8000);
}

// === Этап 3: Крейсерский полёт ===
async function startCruiseStage(userId, peerId) {
  const flightData = global.activeFlights.get(userId);
  if (!flightData) return;
  
  flightData.stage = 'cruise';
  
  const scenarios = [
    {
      id: 'storm',
      message: '⛈️ КРИТИЧЕСКАЯ СИТУАЦИЯ\n\nВпереди мощная грозовая система!\n🌩️ Высота облаков: 12000м\n💨 Турбулентность: сильная\n\nВаше решение, капитан?',
      options: [
        { event_id: 9102, label: '🔄 Обойти грозу (+ 30 мин)', score: +15 },
        { event_id: 9103, label: '⬆️ Набрать высоту над грозой', score: +5 },
        { event_id: 9104, label: '➡️ Лететь напрямик', score: -20 }
      ]
    },
    {
      id: 'engine',
      message: '🚨 ТЕХНИЧЕСКАЯ НЕИСПРАВНОСТЬ\n\n⚠️ Предупреждение: падение давления масла в двигателе №2\n🔧 Все системы пока функционируют\n📊 Запас топлива: достаточный\n\nВаши действия?',
      options: [
        { event_id: 9105, label: '🛬 Экстренная посадка', score: +20 },
        { event_id: 9106, label: '🔍 Продолжить с мониторингом', score: -5 },
        { event_id: 9107, label: '🎯 Лететь к назначению', score: -15 }
      ]
    }
  ];
  
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  flightData.currentScenario = scenario;
  
  const buttons = scenario.options.map(option => [{
    action: {
      type: 'callback',
      payload: JSON.stringify({ event_id: option.event_id, user_id: userId }),
      label: option.label
    },
    color: option.score > 0 ? 'positive' : option.score < -10 ? 'negative' : 'secondary'
  }]);
  
  // Редактируем существующее сообщение
  try {
    await vk.api.messages.edit({
      peer_id: peerId,
      conversation_message_id: flightData.messageId,
      message: scenario.message,
      keyboard: JSON.stringify({
        inline: true,
        buttons: buttons
      })
    });
  } catch (error) {
    logger.error('Ошибка при редактировании сообщения крейсерского полёта:', error);
  }
}

// === Этап 4: Посадка ===
async function startLandingStage(userId, peerId, decision) {
  const flightData = global.activeFlights.get(userId);
  if (!flightData) return;
  
  const scenario = flightData.currentScenario;
  const selectedOption = scenario.options.find(opt => opt.event_id.toString() === decision.toString());
  
  if (selectedOption) {
    flightData.score += selectedOption.score;
    flightData.decisions.push(decision);
  }
  
  flightData.stage = 'landing';
  
  // Сообщение о результате решения
  let resultMessage = '';
  if (selectedOption) {
    if (selectedOption.score > 10) {
      resultMessage = '✅ Отличное решение! Безопасность пассажиров обеспечена.';
    } else if (selectedOption.score > 0) {
      resultMessage = '👍 Правильное решение. Ситуация под контролем.';
    } else {
      resultMessage = '⚠️ Рискованное решение. Полёт продолжается с повышенным вниманием.';
    }
  }
  
  // Редактируем существующее сообщение
  try {
    await vk.api.messages.edit({
      peer_id: peerId,
      conversation_message_id: flightData.messageId,
      message: `${resultMessage}\n\n🛬 Подготовка к посадке\n📡 Диспетчер разрешил заход на посадку\n🌤️ Видимость: хорошая\n\nВыберите тип посадки:`,
      keyboard: JSON.stringify({
        inline: true,
        buttons: [
          [{
            action: {
              type: 'callback',
              payload: JSON.stringify({ event_id: 9108, user_id: userId }),
              label: '🎯 Автоматическая посадка'
            },
            color: 'positive'
          }],
          [{
            action: {
              type: 'callback',
              payload: JSON.stringify({ event_id: 9109, user_id: userId }),
              label: '✋ Ручная посадка'
            },
            color: 'primary'
          }]
        ]
      })
    });
  } catch (error) {
    logger.error('Ошибка при редактировании сообщения посадки:', error);
  }
}

// === Завершение полёта ===
async function completeInteractiveFlight(userId, peerId, landingType) {
  const flightData = global.activeFlights.get(userId);
  if (!flightData) return;
  
  // Бонус за тип посадки
  if (landingType === 9108) { // Автоматическая
    flightData.score += 5;
  } else { // Ручная
    flightData.score += 10;
  }
  
  flightData.decisions.push(landingType);
  
  // Завершаем полёт и рассчитываем зарплату
  const { completeFlight } = require('./pilotManager.js');
  const { getUserBalance, updateUserBalance } = require('./filedb.js');
  const flightResult = completeFlight(userId);
  
  if (flightResult) {
    // Рассчитываем итоговую зарплату на основе решений
    let salaryMultiplier = 1.0;
    
    if (flightData.score >= 120) {
      salaryMultiplier = 2.0; // Отличная работа
    } else if (flightData.score >= 100) {
      salaryMultiplier = 1.5; // Хорошая работа
    } else if (flightData.score >= 80) {
      salaryMultiplier = 1.0; // Нормальная работа
    } else {
      salaryMultiplier = 0.7; // Плохая работа
    }
    
    const finalSalary = Math.round(flightResult.salary * salaryMultiplier);
    
    // Обновляем баланс
    const currentBalance = await getUserBalance(userId);
    const newBalance = currentBalance + finalSalary;
    await updateUserBalance(userId, newBalance);
    
    const { getlink } = require('./util.js');
    const pilotName = await getlink(userId);
    
    // Определяем оценку работы
    let performance = '';
    if (flightData.score >= 120) {
      performance = '🏆 Превосходно!';
    } else if (flightData.score >= 100) {
      performance = '✅ Отлично!';
    } else if (flightData.score >= 80) {
      performance = '👍 Хорошо';
    } else {
      performance = '⚠️ Удовлетворительно';
    }
    
    const landingText = landingType === 9108 ? '🎯 Автоматическая посадка' : '✋ Ручная посадка';
    const finalMessage = `${landingText}\n\n✈️ Рейс завершён\nКапитан ${pilotName} успешно выполнил рейс\n${performance} (${flightData.score} баллов)\n💵 Выплата: ${finalSalary.toLocaleString()} $\n💰 Новый баланс: ${newBalance.toLocaleString()} $`;
    
    // Редактируем существующее сообщение с итоговой информацией
    try {
      await vk.api.messages.edit({
        peer_id: peerId,
        conversation_message_id: flightData.messageId,
        message: finalMessage
      });
    } catch (error) {
      logger.error('Ошибка при редактировании итогового сообщения полёта:', error);
      // Если редактирование не удалось, отправляем новое сообщение
      await vk.api.messages.send({
        peer_id: peerId,
        message: finalMessage,
        random_id: Math.floor(Math.random() * 1000000)
      });
    }
  }
  
  // Очищаем данные полёта
  global.activeFlights.delete(userId);
}

