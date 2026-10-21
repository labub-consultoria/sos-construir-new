import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";
import { ensureBucket, saveImage, getImage, allowedImageTypes } from "./storage.js";
import { validateEmpresa, validatePrestador } from "./validate.js";

const frontend = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../frontend");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, allowedImageTypes.includes(file.mimetype)),
});

const app = express();
app.use(express.static(frontend, { extensions: ["html"] }));

const handler = (fn) => (req, res, next) => fn(req, res).catch(next);

app.post("/api/empresas", upload.single("logo"), handler(async (req, res) => {
  const { errors, value } = validateEmpresa(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  const logoKey = req.file ? await saveImage("logos", req.file) : null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO empresas (razao_social, nome, documento, segmento, cidade, logo_key)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [value.razaoSocial, value.nomeEmpresa, value.documento, value.segmento, value.cidade, logoKey],
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ errors: { cnpj: "Este CNPJ/CPF já está cadastrado." } });
    throw err;
  }
}));

app.post("/api/prestadores", upload.single("foto"), handler(async (req, res) => {
  const { errors, value } = validatePrestador(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  const fotoKey = req.file ? await saveImage("fotos", req.file) : null;
  const { rows } = await pool.query(
    `INSERT INTO prestadores (nome, nascimento, documento, telefone, endereco, foto_key)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [value.nome, value.nascimento, value.documento, value.telefone, value.endereco, fotoKey],
  );
  res.status(201).json({ id: rows[0].id });
}));

app.get("/api/imagens/:folder/:file", handler(async (req, res) => {
  if (!["logos", "fotos"].includes(req.params.folder)) return res.sendStatus(404);
  try {
    const { stream, contentType } = await getImage(`${req.params.folder}/${req.params.file}`);
    res.type(contentType);
    stream.pipe(res);
  } catch {
    res.sendStatus(404);
  }
}));

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ errors: { imagem: "Imagem muito grande (máx. 5 MB)." } });
  console.error(err);
  res.status(500).json({ error: "Erro interno." });
});

await migrate();
await ensureBucket();
app.listen(process.env.PORT, () => console.log(`http://localhost:${process.env.PORT}`));
