import express from 'express';
import cors from 'cors';
import axios from 'axios';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const upload = multer();

// Update this with your Firebase app URLs
const allowedOrigins = ['https://alphavocab-34746.web.app', 'https://alphavocab-34746.firebaseapp.com', 'http://localhost:3000'];

// Preflight request handling
app.options('*', cors());

// CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SPEECHACE_API_KEY = "W2FkE8ngc6oc7A%2FMW0SsU%2Fh8E%2Bp9WMrP8ZsEqXBg%2Bw9%2BBURRqmUSJCelzjxnhNQ0CurG2a4NAkGSjqsiESPtWOaYEV9hOrkGblOGpBJVO4qEzWa7sKixk%2BE9CXbocssd";
const SPEECHACE_API_URL = "https://api.speechace.co/api/scoring/text/v9/json";

app.post('/api/speechace', upload.single('user_audio_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const formData = new FormData();
        formData.append('text', req.body.text);
        formData.append('user_audio_file', req.file.buffer, req.file.originalname);
        formData.append('question_info', req.body.question_info);
        formData.append('no_mc', req.body.no_mc);

        const response = await axios.post(SPEECHACE_API_URL, formData, {
            params: {
                key: SPEECHACE_API_KEY,
                dialect: req.query.dialect,
                user_id: req.query.user_id,
            },
            headers: {
                ...formData.getHeaders(),
            },
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error proxying request to Speechace:', error);
        if (error.response) {
            console.error('Speechace API response:', error.response.data);
            res.status(error.response.status).json({ error: 'Error from Speechace API', details: error.response.data });
        } else if (error.request) {
            console.error('No response received from Speechace API');
            res.status(500).json({ error: 'No response received from Speechace API' });
        } else {
            console.error('Error setting up the request:', error.message);
            res.status(500).json({ error: 'Error setting up the request', message: error.message });
        }
    }
});

app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
});
