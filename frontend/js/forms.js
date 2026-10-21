const onlyDigits = (v) => v.replace(/\D/g, "");

function maskCpfCnpj(v) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

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

const validators = {
  text: (v) => (v.trim().length >= 2 ? "" : "Preencha este campo."),
  cpfcnpj: (v) => {
    const d = onlyDigits(v);
    if (d.length === 11) return validCpf(d) ? "" : "CPF inválido.";
    if (d.length === 14) return validCnpj(d) ? "" : "CNPJ inválido.";
    return "Digite um CNPJ (14 dígitos) ou CPF (11 dígitos).";
  },
  rgcpf: (v) => {
    const d = onlyDigits(v);
    if (d.length === 11 && v.trim().length <= 14) return validCpf(d) ? "" : "CPF inválido.";
    return v.trim().length >= 5 ? "" : "Informe um RG ou CPF válido.";
  },
  phone: (v) => {
    const d = onlyDigits(v);
    return d.length === 10 || d.length === 11 ? "" : "Digite um telefone com DDD.";
  },
  date: (v) => {
    if (!v) return "Informe a data de nascimento.";
    const dt = new Date(v);
    const today = new Date();
    if (isNaN(dt) || dt > today) return "Data inválida.";
    const age = today.getFullYear() - dt.getFullYear();
    return age >= 18 && age < 120 ? "" : "É necessário ter 18 anos ou mais.";
  },
};

const masks = { cpfcnpj: maskCpfCnpj, phone: maskPhone };

const endpoints = { empresa: "/api/empresas", prestador: "/api/prestadores" };

async function submitRegistration(type, formData) {
  try {
    const res = await fetch(endpoints[type], { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, errors: body.errors ?? (res.ok ? {} : { _: "Não foi possível enviar. Tente novamente." }) };
  } catch {
    return { ok: false, errors: { _: "Sem conexão com o servidor. Tente novamente." } };
  }
}

const MAX_IMAGE = 5 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];

validators.image = (_v, input) => {
  const file = input.files[0];
  if (!file) return "";
  if (!imageTypes.includes(file.type)) return "Use uma imagem JPG, PNG ou WebP.";
  return file.size > MAX_IMAGE ? "Imagem muito grande (máx. 5 MB)." : "";
};

function setupForm(form, type) {
  const fields = [...form.querySelectorAll(".field")];
  const success = document.querySelector(".success");
  const card = form.closest(".card");

  const check = (field) => {
    const input = field.querySelector("input");
    const msg = validators[input.dataset.validate](input.value, input);
    field.classList.toggle("invalid", Boolean(msg));
    field.querySelector(".error").textContent = msg;
    return !msg;
  };

  fields.forEach((field) => {
    const input = field.querySelector("input");
    const mask = masks[input.dataset.mask];
    if (mask) input.addEventListener("input", () => { input.value = mask(input.value); });
    input.addEventListener("blur", () => check(field));
    input.addEventListener("input", () => field.classList.contains("invalid") && check(field));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const results = fields.map(check);
    if (results.includes(false)) {
      fields[results.indexOf(false)].querySelector("input").focus();
      return;
    }
    const btn = form.querySelector(".btn");
    const formError = form.querySelector(".form-error");
    formError.textContent = "";
    btn.disabled = true;
    const res = await submitRegistration(type, new FormData(form));
    btn.disabled = false;
    if (res.ok) {
      form.style.display = "none";
      card.querySelector(".card-head").style.display = "none";
      success.classList.add("show");
      return;
    }
    for (const [name, msg] of Object.entries(res.errors)) {
      const field = form.querySelector(`[name="${name}"]`)?.closest(".field");
      if (!field) { formError.textContent = msg; continue; }
      field.classList.add("invalid");
      field.querySelector(".error").textContent = msg;
    }
  });

  form.querySelector("[data-clear]").addEventListener("click", () => {
    form.reset();
    fields.forEach((f) => f.classList.remove("invalid"));
  });
}
