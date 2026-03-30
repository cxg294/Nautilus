/**
 * SB3 Parser - Extracts project.json and asset list from .sb3 files
 */
import JSZip from 'jszip';

/**
 * Parse an SB3 file (ZIP) or raw project.json
 * @param {File} file - The uploaded file
 * @returns {Promise<{project: Object, assets: Map<string, Blob>, fileName: string}>}
 */
export async function parseSB3(file) {
  const fileName = file.name;

  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const project = JSON.parse(text);
    return { project, assets: new Map(), fileName, fileSize: file.size };
  }

  // .sb3 = ZIP file
  const zip = await JSZip.loadAsync(file);
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('无效的 SB3 文件：找不到 project.json');
  }

  const projectText = await projectFile.async('text');
  const project = JSON.parse(projectText);

  // Extract all asset files
  const assets = new Map();
  const entries = Object.entries(zip.files);
  for (const [path, entry] of entries) {
    if (path === 'project.json' || entry.dir) continue;
    const blob = await entry.async('blob');
    assets.set(path, blob);
  }

  return { project, assets, fileName, fileSize: file.size };
}

/**
 * Export a modified project back to .sb3
 * @param {Object} project - The project.json data
 * @param {Map<string, Blob>} assets - Asset files
 * @param {string} fileName - Name for the exported file
 */
export async function exportSB3(project, assets, fileName = 'project.sb3') {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project));

  for (const [path, blob] of assets) {
    zip.file(path, blob);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, fileName);
}

/**
 * Export project.json only
 */
export function exportJSON(project, fileName = 'project.json') {
  const text = JSON.stringify(project, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  downloadBlob(blob, fileName);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
