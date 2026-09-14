import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';

/**
 * Photos and videos are stored in Cloudinary.
 *
 * Since Firebase Storage requires a paid plan (Blaze), Cloudinary's free
 * tier is used: 25 GB space, photo and video support, no card required.
 * Uploading is done directly from the phone with an "unsigned upload preset"; thus,
 * no secret key is embedded in the application.
 */

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/** Largest file that can be uploaded. Cloudinary free tier allows 100 MB. */
export const MAX_MEDIA_BYTES = 60 * 1024 * 1024; // 60 MB

export interface PickedMedia {
  uri: string;
  kind: 'image' | 'video' | 'file';
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
}

export interface UploadedMedia {
  url: string;
  /** Preview address generated from the first frame in videos. */
  thumbUrl: string | null;
}

/** Clear errors that can be shown directly to the user. */
export class MediaError extends Error {}

function toPickedMedia(asset: ImagePicker.ImagePickerAsset): PickedMedia {
  return {
    uri: asset.uri,
    kind: asset.type === 'video' ? 'video' : 'image',
    fileSize: asset.fileSize,
    fileName: asset.fileName ?? undefined,
    mimeType: asset.mimeType ?? undefined,
  };
}

/** Prompts to pick a photo or video from the gallery. Returns null if the user cancels. */
export async function pickFromGallery(): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new MediaError(
      'Gallery permission not granted. You must grant photo access to the app from phone settings.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.7, // compresses the photo slightly, upload speeds up
    videoMaxDuration: 180,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return toPickedMedia(result.assets[0]);
}

/** Opens the camera, takes a photo or video. Returns null if the user cancels. */
export async function captureWithCamera(): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new MediaError(
      'Camera permission not granted. You must grant camera access to the app from phone settings.'
    );
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.7,
    videoMaxDuration: 180,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return toPickedMedia(result.assets[0]);
}

/** Extracts extension from file name; gives default based on type if not found. */
function guessExtension(media: PickedMedia) {
  const candidate = (media.fileName ?? media.uri).split('?')[0].split('.').pop();
  if (candidate && candidate.length <= 5 && /^[a-zA-Z0-9]+$/.test(candidate)) return candidate.toLowerCase();
  if (media.kind === 'file') return 'bin';
  return media.kind === 'video' ? 'mp4' : 'jpg';
}

function guessMimeType(media: PickedMedia, extension: string) {
  if (media.mimeType) return media.mimeType;
  if (media.kind === 'file') return 'application/octet-stream';
  if (media.kind === 'video') return extension === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  return 'image/jpeg';
}

/**
 * We use XMLHttpRequest because fetch does not report upload progress;
 * without progress, the app seems frozen on large videos.
 */
function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress?: (ratio: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(event.loaded / event.total);
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText));
        } catch {
          reject(new MediaError('Received an unexpected response from the server.'));
        }
        return;
      }

      // Cloudinary explains the error in JSON; a simplified version is shown to the user.
      let detail = '';
      try {
        detail = JSON.parse(request.responseText)?.error?.message ?? '';
      } catch {
        detail = request.responseText.slice(0, 120);
      }
      console.warn('[media] Cloudinary error', request.status, detail);

      if (request.status === 400 && /preset/i.test(detail)) {
        reject(
          new MediaError(
            'Upload preset not found. Check the Cloudinary upload preset name (.env file).'
          )
        );
      } else if (request.status === 401 || request.status === 403) {
        reject(
          new MediaError(
            'Cloudinary rejected the upload. Upload preset must be set to "Unsigned".'
          )
        );
      } else {
        reject(new MediaError(`File upload failed (error code ${request.status}).`));
      }
    };

    request.onerror = () => reject(new MediaError('Internet connection could not be established.'));
    request.ontimeout = () => reject(new MediaError('Upload timed out.'));
    request.send(form);
  });
}

/**
 * Uploads the selected media to Cloudinary.
 * onProgress reports progress between 0-1.
 */
export async function uploadMedia(
  chatId: string,
  uid: string,
  media: PickedMedia,
  onProgress?: (ratio: number) => void
): Promise<UploadedMedia> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new MediaError(
      'Cloudinary settings missing. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and ' +
        'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET values to the .env file.'
    );
  }

  if (media.fileSize && media.fileSize > MAX_MEDIA_BYTES) {
    const mb = Math.round(media.fileSize / (1024 * 1024));
    throw new MediaError(
      `File is too large (${mb} MB). You can send at most ${MAX_MEDIA_BYTES / (1024 * 1024)} MB.`
    );
  }

  const extension = guessExtension(media);
  const form = new FormData();
  form.append('file', {
    uri: media.uri,
    type: guessMimeType(media, extension),
    // The original file name is preserved in documents; so it opens with the same name when downloaded.
    name: media.kind === 'file' && media.fileName ? media.fileName : `${Date.now()}.${extension}`,
  } as any);
  form.append('upload_preset', UPLOAD_PRESET);
  // Folders files by chat and sender; makes cleanup easy later.
  form.append('folder', `${chatId}/${uid}`);

  /**
   * Documents are uploaded as "raw" type.
   * When "auto" is selected, Cloudinary considers PDF as an image and puts it under /image/upload/;
   * because PDF delivery in this type is blocked by default,
   * ERR_INVALID_RESPONSE was received when opening the file.
   */
  const type = media.kind === 'file' ? 'raw' : 'auto';
  const result = await uploadWithProgress(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`,
    form,
    onProgress
  );

  const url: string | undefined = result?.secure_url;
  if (!url) throw new MediaError('Upload completed but file address could not be obtained.');

  return { url, thumbUrl: buildVideoThumbUrl(result) };
}

/**
 * Cloudinary can generate a preview from the first frame of videos:
 * just changing the extension at .../video/upload/... to .jpg is enough.
 */
function buildVideoThumbUrl(result: any): string | null {
  if (result?.resource_type !== 'video' || typeof result?.secure_url !== 'string') return null;
  return result.secure_url.replace(/\.[a-zA-Z0-9]+$/, '.jpg');
}


/**
 * Prompts to pick a document from the phone (PDF, APK, document, audio file, etc.).
 * Returns null if the user cancels.
 */
export async function pickDocument(): Promise<PickedMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) return null;
  const file = result.assets[0];

  return {
    uri: file.uri,
    kind: 'file',
    fileSize: file.size ?? undefined,
    fileName: file.name,
    mimeType: file.mimeType ?? undefined,
  };
}

/** Converts file size to a readable format. */
export function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Saves an incoming photo/video to the phone gallery.
 * Called when "Save to gallery" is on in settings and the user chooses to download.
 */
export async function saveToGallery(url: string, fileName?: string) {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new MediaError('Permission required to save to gallery.');
  }

  const name = fileName || url.split('/').pop()?.split('?')[0] || `file-${Date.now()}`;
  const downloaded = await File.downloadFileAsync(url, new File(Paths.cache, name));
  const asset = await MediaLibrary.createAssetAsync(downloaded.uri);

  // Grouped in a separate album named "Family Chat".
  const album = await MediaLibrary.getAlbumAsync('Family Chat');
  if (album) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  } else {
    await MediaLibrary.createAlbumAsync('Family Chat', asset, false);
  }

  return asset.uri;
}

/**
 * Saves the document to the phone's downloads folder.
 * Documents are handled separately because the gallery only accepts photos/videos.
 */
export async function saveDocument(url: string, fileName: string) {
  const downloaded = await File.downloadFileAsync(url, new File(Paths.document, fileName));
  return downloaded.uri;
}
