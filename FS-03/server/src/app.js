import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());                                              // secure HTTP headers
app.use(cors({ origin: env.clientUrl, credentials: true }));    // only our React app may call the API
app.use(express.json({ limit: '1mb' }));                        // parse JSON bodies
app.use(express.urlencoded({ extended: true }));
if (!isProd) app.use(morgan('dev'));                            // request logging in development

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
