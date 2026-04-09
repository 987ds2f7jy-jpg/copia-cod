import { invokeEdgeFunction } from './edgeFunctions';

export async function uploadPublicFile({ file, folder = 'public' }) {
  const formData = new FormData();
  formData.append('folder', folder);
  formData.append('file', file);

  const result = await invokeEdgeFunction('upload-public-file', {
    body: formData,
    fallbackMessage: 'Nao foi possivel enviar o arquivo.',
  });

  return result?.file ?? null;
}

export async function deleteUploadedFiles({ paths }) {
  const normalizedPaths = Array.isArray(paths)
    ? paths.map((path) => String(path || '').trim()).filter(Boolean)
    : [];

  if (normalizedPaths.length === 0) {
    return { deletedPaths: [] };
  }

  return invokeEdgeFunction('delete-uploaded-files', {
    body: {
      paths: normalizedPaths,
    },
    fallbackMessage: 'Nao foi possivel remover os arquivos enviados.',
  });
}
