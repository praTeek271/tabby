import { Note } from './types';

const FOLDER_NAME = 'Tabby Notepad Sync';

export class DriveSyncService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async fetchAPI(url: string, options: RequestInit = {}) {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.token}`,
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      let errText = '';
      try { errText = await response.text(); } catch(e) {}
      throw new Error(`Drive API error (${response.status}): ${errText}`);
    }
    // Only return JSON if there's content. Delete returns empty 204.
    if (response.status === 204) return null;
    return response.json();
  }

  async getFolderId(): Promise<string | null> {
    const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const data = await this.fetchAPI(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`);
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  async createFolder(): Promise<string> {
    const body = {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    };
    const data = await this.fetchAPI('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return data.id;
  }

  private getFilename(note: Note): string {
    const firstLine = (note.content || '').split('\n')[0].trim();
    const sanitized = firstLine.replace(/[^\w\s-]/gi, '').substring(0, 12).trim() || 'untitled';
    const shortId = note.id.substring(note.id.length - 8); // uuid8
    return `.temp-${sanitized}-${shortId}.txt`;
  }

  async uploadData(folderId: string, notes: Note[], onProgress?: (msg: string) => void): Promise<void> {
    if (onProgress) onProgress('Fetching current Drive state...');
    
    // First, get all current files in the folder
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const searchData = await this.fetchAPI(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`);
    const existingFiles = searchData.files || [];
    
    const existingMap = new Map<string, string>(); // name -> id
    existingFiles.forEach((f: any) => existingMap.set(f.name, f.id));

    // Prepare metadata and new files structure
    const metadataRecords: any[] = [];
    const desiredFileNames = new Set<string>();
    desiredFileNames.add('metadata.json');

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const filename = this.getFilename(note);
      desiredFileNames.add(filename);

      metadataRecords.push({
        id: note.id,
        fileName: filename,
        viewMode: note.viewMode,
        color: note.color,
        timestamp: note.timestamp,
        userId: note.userId
      });

      if (onProgress) onProgress(`Uploading ${i + 1}/${notes.length}: ${filename}`);
      await this.uploadFileContent(folderId, filename, note.content, existingMap.get(filename));
    }

    if (onProgress) onProgress('Uploading metadata.json...');
    await this.uploadFileContent(folderId, 'metadata.json', JSON.stringify(metadataRecords, null, 2), existingMap.get('metadata.json'));

    if (onProgress) onProgress('Cleaning up removed tabs...');
    // Delete files that are in Drive but no longer needed
    let deletedCount = 0;
    for (const [name, id] of existingMap.entries()) {
      if (!desiredFileNames.has(name) && name.endsWith('.txt')) {
        try {
          await this.fetchAPI(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE' });
          deletedCount++;
        } catch(e) {
          console.error("Failed to delete old file", name, e);
        }
      }
    }
    if (onProgress && deletedCount > 0) onProgress(`Cleaned up ${deletedCount} old files.`);
  }

  private async uploadFileContent(folderId: string, name: string, content: string, existingId?: string) {
    const form = new FormData();
    const metadata = existingId ? { name } : { name, parents: [folderId] };
    const contentType = name.endsWith('.json') ? 'application/json' : 'text/plain';

    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: contentType }));

    const url = existingId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const method = existingId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: form
    });
    
    if (!response.ok) {
       if (response.status === 401) throw new Error('UNAUTHORIZED');
       throw new Error(`Failed to upload file ${name}`);
    }
  }

  async downloadData(folderId: string, onProgress?: (msg: string) => void): Promise<Note[] | null> {
    if (onProgress) onProgress('Fetching metadata.json...');
    const q = encodeURIComponent(`name='metadata.json' and '${folderId}' in parents and trashed=false`);
    const searchData = await this.fetchAPI(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`);
    
    if (!searchData.files || searchData.files.length === 0) return null;
    
    const metadataId = searchData.files[0].id;
    const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${metadataId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (!metaResponse.ok) {
      if (metaResponse.status === 401) throw new Error('UNAUTHORIZED');
      return null;
    }
    const metadataRecords = await metaResponse.json();

    if (onProgress) onProgress('Fetching folder contents...');
    // We get file ids for everything to avoid multiple queries
    const qAll = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const searchAllData = await this.fetchAPI(`https://www.googleapis.com/drive/v3/files?q=${qAll}&spaces=drive&fields=files(id,name)`);
    const existingMap = new Map<string, string>(); // name -> id
    (searchAllData.files || []).forEach((f: any) => existingMap.set(f.name, f.id));

    const finalNotes: Note[] = [];
    for (let i = 0; i < metadataRecords.length; i++) {
        const record = metadataRecords[i];
        if (onProgress) onProgress(`Downloading ${i + 1}/${metadataRecords.length}: ${record.fileName}`);
        
        const fileId = existingMap.get(record.fileName);
        let content = '';
        if (fileId) {
             const contentResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
             });
             if (contentResp.ok) {
                 content = await contentResp.text();
             }
        }
        
        finalNotes.push({
            id: record.id,
            userId: record.userId || 'local',
            content: content,
            timestamp: record.timestamp,
            color: record.color,
            viewMode: record.viewMode
        });
    }

    return finalNotes;
  }
}
