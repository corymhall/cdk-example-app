import express, { Request, Response } from 'express';

const app = express();
app.get('/', (_req: Request, res: Response) => {
  res.send(JSON.stringify({ message: 'NodeJs App Running on Amazon ECS Fargate' }));
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send(JSON.stringify({ message: 'NodeJs App Running on Amazon ECS Fargate' }));
});

app.listen(8080, () => {
  console.log('server connected');
});
