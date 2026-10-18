// Sjednocení řádků, které do Sheetu nezapsala appka (ruční úprava, Cowork úloha z atletika.cz):
// disciplína podle názvu („100 m“ → '100'), výkony z textu („4:35,20“ → 275.2), česká data → ISO, chybějící body.
import { DISCIPLINES } from '../config.js';
import { parsePerf, points } from '../calc/wa.js';

const PERF_FIELDS = { Zavody: ['vykon'], PB_Plany: ['pb', 'pb_venku', 'pb_hala', 'vykon_letos', 'plan_letos', 'plan_pristi', 'rekord_cr', 'rekord_sr'] };
const DATE_FIELDS = ['datum', 'pb_datum', 'pb_venku_datum', 'pb_hala_datum'];

const plain = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s.]/g, '');
const BY_NAME = new Map(DISCIPLINES.flatMap(d => [[plain(d.id), d.id], [plain(d.label), d.id]]));
// běžné varianty názvů z výsledků
[['110mpr', '110pr'], ['110mprekazky', '110pr'], ['110mh', '110pr'], ['60mpr', '60pr'], ['60mprekazky', '60pr'], ['60mh', '60pr'],
  ['skokdaleky', 'dalka'], ['skokvysoky', 'vyska'], ['skokotyci', 'tyc'], ['vrhkouli', 'koule'], ['hoddiskem', 'disk'], ['hodostepem', 'ostep'],
  ['100m', '100'], ['200m', '200'], ['400m', '400'], ['1500m', '1500'], ['1000m', '1000'], ['60m', '60']]
  .forEach(([k, v]) => BY_NAME.set(k, v));

export const discId = v => (v == null ? v : BY_NAME.get(plain(v)) ?? v);

function isoDate(v) {
  if (typeof v !== 'string') return v;
  const m = v.trim().match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v;
}

export function normalizeRow(sheet, r) {
  DATE_FIELDS.forEach(f => { if (r[f] != null) r[f] = isoDate(r[f]); });
  if (!PERF_FIELDS[sheet]) return r;
  if (r.disciplina != null) r.disciplina = discId(r.disciplina);
  PERF_FIELDS[sheet].forEach(f => {
    if (typeof r[f] === 'string') r[f] = parsePerf(r.disciplina, r[f]);
  });
  if (sheet === 'Zavody' && r.body == null && r.vykon != null) r.body = points(r.disciplina, r.vykon, { hand: !!r.rucne });
  return r;
}
