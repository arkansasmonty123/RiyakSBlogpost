import { startServer } from './api';

const port = Number(process.env.PORT ?? 8787);
startServer(port);
