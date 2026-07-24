import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';

export const ROOT_PARENT_FOLDER_ID = '1F1Wl-HKI4IcSdJZ8aq59CSKDc2-SfSsL';
export const ROOT_PARENT_FOLDER_URL = `https://drive.google.com/drive/folders/${ROOT_PARENT_FOLDER_ID}`;

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize Google Auth state listener
export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) return () => {};

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might have expired or not present yet
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google and request Google Drive scope
export const googleSignInWithDrive = async (): Promise<{ user: User; accessToken: string }> => {
  if (!auth) throw new Error('Firebase auth not initialized');

  isSigningIn = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Could not retrieve Google Drive access token');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error('Google Sign In with Drive error:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedDriveToken = (): string | null => {
  return cachedAccessToken;
};

// Search or create a subfolder for a form inside the main Google Drive folder
export const getOrCreateFormFolder = async (
  formTitle: string,
  accessToken: string,
  parentFolderId: string = ROOT_PARENT_FOLDER_ID
): Promise<{ id: string; webViewLink?: string }> => {
  const cleanTitle = (formTitle || 'Untitled Form').replace(/'/g, "\\'");

  try {
    // 1. Search for existing folder with exact form title in the parent folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${parentFolderId}'+in+parents+and+name='${cleanTitle}'+and+mimeType='application/vnd.google.apps.folder'+and+trashed=false&fields=files(id,name,webViewLink)`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return { id: data.files[0].id, webViewLink: data.files[0].webViewLink };
      }
    }

    // 2. Folder not found -> Create a new folder inside parentFolderId
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: formTitle || 'Untitled Form',
        mimeType: 'application/vnd.google.apps.folder',
        parents: [parentFolderId],
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('Failed to create Drive folder:', errText);
      throw new Error(`Google Drive folder creation failed: ${createRes.statusText}`);
    }

    const folder = await createRes.json();

    // 3. Set public/reader permissions on folder so shared link works seamlessly
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${folder.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
    } catch (permErr) {
      console.warn('Could not set reader permissions on drive folder:', permErr);
    }

    return { id: folder.id, webViewLink: folder.webViewLink };
  } catch (err) {
    console.error('Error in getOrCreateFormFolder:', err);
    throw err;
  }
};

// Upload a single file to a specific Google Drive folder
export const uploadFileToGoogleDrive = async (
  file: File,
  formTitle: string,
  accessToken?: string,
  parentFolderId: string = ROOT_PARENT_FOLDER_ID
): Promise<{
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  driveFolderId: string;
  driveFolderUrl: string;
  size: number;
  type: string;
}> => {
  let token = accessToken || cachedAccessToken;

  if (!token) {
    // Attempt sign in if token is missing
    const authResult = await googleSignInWithDrive();
    token = authResult.accessToken;
  }

  // Get or create form subfolder
  const folder = await getOrCreateFormFolder(formTitle, token, parentFolderId);

  // Perform multipart upload to Google Drive API v3
  const metadata = {
    name: file.name,
    parents: [folder.id],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();

  const fileDataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Extract raw base64 data
  const base64Data = fileDataUrl.split(',')[1];

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Data +
    closeDelimiter;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    console.error('Google Drive Upload Error:', errBody);
    throw new Error(`Google Drive Upload Failed (${uploadRes.status}): ${uploadRes.statusText}`);
  }

  const fileResult = await uploadRes.json();

  // Set reader permission on file
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileResult.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (permErr) {
    console.warn('Could not set file permissions:', permErr);
  }

  const driveFolderUrl = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;

  return {
    id: fileResult.id,
    name: file.name,
    webViewLink: fileResult.webViewLink || `https://drive.google.com/file/d/${fileResult.id}/view`,
    webContentLink: fileResult.webContentLink,
    driveFolderId: folder.id,
    driveFolderUrl,
    size: file.size,
    type: file.type,
  };
};
