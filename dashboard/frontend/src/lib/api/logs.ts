import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005',
});

export interface Tag {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  startedAt: string;
  endedAt?: string;
}

export interface Log {
  id: string;
  message: string;
  branch?: string;
  commitHash?: string;
  createdAt: string;
  project: Project;
  session?: Session;
  tags: Tag[];
}

export const getLogs = async (projectId?: string): Promise<Log[]> => {
  const { data } = await api.get('/logs', { params: { projectId } });
  return data;
};
