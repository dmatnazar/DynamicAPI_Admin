/**
 * Lightweight SQL beautifier (Navicat-style-ish).
 * Not a full parser — good enough for T-SQL SELECT/INSERT/UPDATE/DELETE.
 */
const BREAK_BEFORE = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'INNER JOIN', 'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON',
  'GROUP BY', 'ORDER BY', 'HAVING', 'UNION', 'UNION ALL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'WITH', 'AS', 'TOP', 'DISTINCT', 'LIMIT', 'OFFSET',
];

export function formatSql(input: string): string {
  if (!input?.trim()) return input;

  // Preserve string literals temporarily
  const strings: string[] = [];
  let sql = input.replace(/('([^']|'')*')/g, (m) => {
    strings.push(m);
    return `__STR${strings.length - 1}__`;
  });

  // Normalize whitespace
  sql = sql.replace(/\s+/g, ' ').trim();

  // Uppercase keywords (outside strings)
  const kwRe = new RegExp(
    `\\b(${[
      'select','from','where','and','or','join','left','right','inner','outer','full','cross',
      'on','group','by','order','having','union','all','insert','into','values','update','set',
      'delete','with','as','top','distinct','limit','offset','case','when','then','else','end',
      'not','in','is','null','like','between','exists','asc','desc','over','partition',
    ].join('|')})\\b`,
    'gi'
  );
  sql = sql.replace(kwRe, (m) => m.toUpperCase());

  // Break before major clauses (longest first)
  const sorted = [...BREAK_BEFORE].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    const re = new RegExp(`\\s+${kw.replace(/ /g, '\\s+')}\\b`, 'gi');
    sql = sql.replace(re, `\n${kw}`);
  }

  // Comma newline in SELECT list (heuristic)
  const lines = sql.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  let indent = 0;

  for (let line of lines) {
    const upper = line.toUpperCase();
    if (/^(WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|GROUP|ORDER|HAVING|UNION|SET|VALUES)/.test(upper)) {
      indent = 1;
    } else if (/^(SELECT|FROM|INSERT|UPDATE|DELETE|WITH)/.test(upper)) {
      indent = 0;
    }

    // Split long SELECT lists by comma
    if (upper.startsWith('SELECT ') && line.includes(',')) {
      const rest = line.slice(6).trim();
      out.push('SELECT');
      const cols = rest.split(',').map((c) => c.trim()).filter(Boolean);
      cols.forEach((c, i) => {
        out.push(`  ${c}${i < cols.length - 1 ? ',' : ''}`);
      });
      continue;
    }

    const pad = '  '.repeat(indent > 0 && !/^(SELECT|FROM|INSERT|UPDATE|DELETE|WITH)/.test(upper) ? 1 : 0);
    out.push(pad + line);
  }

  sql = out.join('\n');

  // Restore strings
  sql = sql.replace(/__STR(\d+)__/g, (_, i) => strings[Number(i)]);

  return sql.trim() + '\n';
}
