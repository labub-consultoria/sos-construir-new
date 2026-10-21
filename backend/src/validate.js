const digits = (v) => String(v ?? "").replace(/\D/g, "");

function validCpf(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}

function validCnpj(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [12, 13]) {
    const weights = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    if (((sum % 11) < 2 ? 0 : 11 - (sum % 11)) !== Number(d[n])) return false;
  }
  return true;
}

const text = (v) => typeof v === "string" && v.trim().length >= 2;

export function validateEmpresa(b) {
  const errors = {};
  for (const f of ["razaoSocial", "nomeEmpresa", "segmento", "cidade"]) if (!text(b[f])) errors[f] = "Preencha este campo.";
  const d = digits(b.cnpj);
  if (!(validCnpj(d) || validCpf(d))) errors.cnpj = "CNPJ ou CPF inválido.";
  return {
    errors,
    value: {
      razaoSocial: b.razaoSocial?.trim(),
      nomeEmpresa: b.nomeEmpresa?.trim(),
      documento: d,
      segmento: b.segmento?.trim(),
      cidade: b.cidade?.trim(),
    },
  };
}

export function validatePrestador(b) {
  const errors = {};
  for (const f of ["nome", "endereco"]) if (!text(b[f])) errors[f] = "Preencha este campo.";
  const doc = String(b.documento ?? "").trim();
  const dd = digits(doc);
  if (dd.length === 11 && doc.length <= 14 ? !validCpf(dd) : doc.length < 5) errors.documento = "RG ou CPF inválido.";
  const tel = digits(b.telefone);
  if (tel.length !== 10 && tel.length !== 11) errors.telefone = "Telefone inválido.";
  const dt = new Date(b.nascimento);
  const now = new Date();
  const age = now.getFullYear() - dt.getFullYear();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.nascimento ?? "") || isNaN(dt) || dt > now || age < 18 || age >= 120) {
    errors.nascimento = "Data de nascimento inválida (mínimo 18 anos).";
  }
  return {
    errors,
    value: { nome: b.nome?.trim(), nascimento: b.nascimento, documento: doc, telefone: b.telefone, endereco: b.endereco?.trim() },
  };
}
