export function renderTemplate({ template, variables }) {
  let html = template.body_html || '';
  let text = template.body_text || '';
  const subj = template.subject || '';

  const replace = (s) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
    const v = variables[key];
    return v === undefined || v === null ? '' : String(v);
  });

  return {
    subject: replace(subj),
    html: replace(html),
    text: replace(text)
  };
}












