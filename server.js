import express from 'express';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

const upload = multer();

app.use(cors());

const SPEECHACE_API_KEY = "O5ckl2iZ%2BZL%2BObNIZ2C97Idf54nmJSbe4rVnS93EP1I8CKI9x5vwjqCpOL89jZ4lOZMz3tpsxgbh5%2FioyMdV6YgUyjaPff8F366fVxF1%2BJn1MtAgEQbmZO96Us7mgH3W";
const SPEECHACE_API_URL = "https://api.speechace.co/api/scoring/text/v9/json";

app.post('/api/speechace', upload.single('user_audio_file'), async (req, res) => {
    try {
        const formData = new FormData();
        formData.append('text', req.body.text);
        formData.append('user_audio_file', new Blob([req.file.buffer]), req.file.originalname);
        formData.append('question_info', req.body.question_info);
        formData.append('no_mc', req.body.no_mc);

        const response = await axios.post(SPEECHACE_API_URL, formData, {
            params: {
                key: SPEECHACE_API_KEY,
                dialect: req.query.dialect,
                user_id: req.query.user_id,
            },
            headers: {
                ...Object.fromEntries(formData.entries()),
                'Content-Type': 'multipart/form-data',
            },
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error proxying request to Speechace:', error);
        res.status(500).json({ error: 'An error occurred while processing your request' });
    }
});

app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
});