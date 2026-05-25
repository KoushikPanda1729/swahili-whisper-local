const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `audio_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// Languages not in Whisper's model — use auto-detection instead
const WHISPER_UNSUPPORTED = new Set(["zu", "ig", "st", "xh"]);

function runWhisper(filePath, language, task) {
  return new Promise((resolve, reject) => {
    const outputDir = "outputs/";
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const langFlag = WHISPER_UNSUPPORTED.has(language) ? "" : `--language ${language}`;
    const command = `whisper "${filePath}" --model large-v3-turbo ${langFlag} --task ${task} --output_dir ${outputDir} --output_format json`;
  // const command = `whisper "${filePath}" --model medium ${langFlag} --task ${task} --output_dir ${outputDir} --output_format json`;
    console.log(`\n🚀 Running Whisper...`);
    console.log(`📁 File: ${filePath}`);
    console.log(`🌍 Language: ${language} | Task: ${task}\n`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Whisper error:", stderr);
        return reject(error);
      }

      const baseName = path.basename(filePath, path.extname(filePath));
      const outputFile = path.join(outputDir, `${baseName}.json`);

      if (fs.existsSync(outputFile)) {
        const result = JSON.parse(fs.readFileSync(outputFile, "utf8"));
        fs.unlinkSync(filePath);
        fs.unlinkSync(outputFile);
        resolve(result);
      } else {
        reject(new Error("Output file not found"));
      }
    });
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "✅ Self-Hosted Whisper Large v3 Turbo Running",
    model: "large-v3-turbo",
    endpoints: {
      transcribe: "POST /transcribe",
      translate: "POST /translate",
      languages: "GET /languages",
    },
  });
});

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "❌ No audio file uploaded" });
    }
    const language = req.body.language || "sw";
    console.log(`🎙️ Transcribing in: ${language}`);
    const result = await runWhisper(req.file.path, language, "transcribe");
    res.json({
      success: true,
      language: result.language,
      text: result.text,
      duration: result.segments?.at(-1)?.end || 0,
      segments: result.segments?.map((s) => ({
        start: s.start.toFixed(2),
        end: s.end.toFixed(2),
        text: s.text.trim(),
      })),
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post("/translate", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "❌ No audio file uploaded" });
    }
    const language = req.body.language || "sw";
    console.log(`🔄 Translating ${language} → English...`);
    const result = await runWhisper(req.file.path, language, "translate");
    res.json({
      success: true,
      original_language: language,
      translated_to: "en",
      text: result.text,
      duration: result.segments?.at(-1)?.end || 0,
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/languages", (req, res) => {
  res.json({
    supported_african_languages: [
      { language: "Swahili",   code: "sw" },
      { language: "Afrikaans", code: "af" },
      { language: "Amharic",   code: "am" },
      { language: "Hausa",     code: "ha" },
      { language: "Yoruba",    code: "yo" },
      { language: "Zulu",      code: "zu" },
      { language: "Somali",    code: "so" },
      { language: "Igbo",      code: "ig" },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server: http://localhost:${PORT}`);
  console.log(`📌 POST http://localhost:${PORT}/transcribe`);
  console.log(`📌 POST http://localhost:${PORT}/translate`);
  console.log(`📌 GET  http://localhost:${PORT}/languages\n`);
});
