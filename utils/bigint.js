// Работа с большими числами (BigInt)
// Все суммы храним как строки, чтобы не терять точность

function toBigInt(value) {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.floor(value));
  const str = String(value).replace(/[^\d-]/g, '');
  if (!str || str === '-') return 0n;
  try {
    return BigInt(str);
  } catch (e) {
    return 0n;
  }
}

function fromBigInt(value) {
  return value.toString();
}

function addBigInt(a, b) {
  return (toBigInt(a) + toBigInt(b)).toString();
}

// Сокращённый формат для вывода
const SUFFIXES = [
  { limit: 10n ** 63n, suffix: 'виг' },   // вигинтиллион
  { limit: 10n ** 60n, suffix: 'нов' },   // новемдециллион
  { limit: 10n ** 57n, suffix: 'октд' },  // октодециллион
  { limit: 10n ** 54n, suffix: 'септд' }, // септендециллион
  { limit: 10n ** 51n, suffix: 'секстд' },// сексдециллион
  { limit: 10n ** 48n, suffix: 'квдц' },  // квиндециллион
  { limit: 10n ** 45n, suffix: 'квтд' },  // кваттуордециллион
  { limit: 10n ** 42n, suffix: 'трдц' },  // тредециллион
  { limit: 10n ** 39n, suffix: 'дцд' },   // дуодециллион
  { limit: 10n ** 36n, suffix: 'унд' },   // ундециллион
  { limit: 10n ** 33n, suffix: 'децлн' }, // дециллион
  { limit: 10n ** 30n, suffix: 'нонлн' }, // нониллион
  { limit: 10n ** 27n, suffix: 'октлн' }, // октиллион
  { limit: 10n ** 24n, suffix: 'сптлн' }, // септиллион
  { limit: 10n ** 21n, suffix: 'скстлн' },// секстиллион
  { limit: 10n ** 18n, suffix: 'квнтлн' },// квинтиллион
  { limit: 10n ** 15n, suffix: 'квдрлн' },// квадриллион
  { limit: 10n ** 12n, suffix: 'трлн' },  // триллион
  { limit: 10n ** 9n,  suffix: 'млрд' },  // миллиард
  { limit: 10n ** 6n,  suffix: 'кк' },    // миллион
  { limit: 10n ** 3n,  suffix: 'к' }      // тысяча
];

function formatBigInt(value) {
  const n = toBigInt(value);
  const negative = n < 0n;
  const abs = negative ? -n : n;

  let result = '';
  for (const { limit, suffix } of SUFFIXES) {
    if (abs >= limit) {
      const divided = Number(abs * 10n / limit) / 10;
      result = `${divided.toFixed(1).replace('.0', '')}${suffix}`;
      break;
    }
  }

  if (!result) {
    result = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  return (negative ? '-' : '') + result + '₽';
}

// Полный формат (все цифры с точками)
function formatFullBigInt(value) {
  const n = toBigInt(value);
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negative ? '-' : '') + str + '₽';
}

// Парсинг строки в BigInt с поддержкой кк/млрд
function parseBigIntAmount(str) {
  const s = String(str).toLowerCase().trim();

  if (s.includes('ккк')) return toBigInt(parseFloat(s.replace('ккк', '')) * 1e12);
  if (s.includes('млрд')) return toBigInt(parseFloat(s.replace('млрд', '')) * 1e9);
  if (s.includes('кк')) return toBigInt(parseFloat(s.replace('кк', '')) * 1e6);
  if (s.includes('к')) return toBigInt(parseFloat(s.replace('к', '')) * 1e3);

  return toBigInt(s);
}

module.exports = {
  toBigInt,
  fromBigInt,
  addBigInt,
  formatBigInt,
  formatFullBigInt,
  parseBigIntAmount,
  SUFFIXES
};