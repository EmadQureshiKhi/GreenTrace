import { toast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';

/** Runs a save and reports the outcome in a toast. Returns true on success. */
export async function runWithToast(action: () => Promise<unknown>, success: { title: string; description?: string }): Promise<boolean> {
  try {
    await action();
    toast(success);
    return true;
  } catch (error) {
    toast({ title: 'Something went wrong', description: errorMessage(error), variant: 'destructive' });
    return false;
  }
}

/** Saves text as a file in the browser. */
export function downloadFile(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A file-name-safe version of a label. */
export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'export';
}
