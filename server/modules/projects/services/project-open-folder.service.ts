import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

import { projectsDb } from '@/modules/database/index.js';
import { AppError } from '@/shared/utils.js';

/** The file manager of the machine the server runs on. */
function fileManagerCommand(): string {
  if (process.platform === 'win32') return 'explorer.exe';
  if (process.platform === 'darwin') return 'open';
  return 'xdg-open';
}

/**
 * Opens a project's directory in the server machine's file manager. The path
 * comes from the database, never from the request, so only registered project
 * directories can be opened.
 */
export function openProjectFolder(projectId: string): string {
  const projectPath = projectsDb.getProjectPathById(projectId.trim());
  if (!projectPath) {
    throw new AppError('Project not found', { code: 'PROJECT_NOT_FOUND', statusCode: 404 });
  }
  if (!existsSync(projectPath)) {
    throw new AppError('The project directory does not exist', { code: 'PROJECT_PATH_MISSING', statusCode: 404 });
  }

  // explorer.exe exits with 1 even on success, so the exit code is ignored.
  const child = spawn(fileManagerCommand(), [projectPath], { detached: true, stdio: 'ignore' });
  child.on('error', (error) => console.error('[projects] Opening the project folder failed:', error));
  child.unref();
  return projectPath;
}
