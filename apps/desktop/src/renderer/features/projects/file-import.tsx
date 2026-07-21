/**
 * File import component for multi-file bid document selection.
 * Re-exports SubmissionFileList and validateFiles for the file import flow.
 * Adds multi-file selection via hidden input and drag-drop with Electron File.path support.
 */
export { SubmissionFileList, validateFiles } from './submission-file-list';
export type { SubmissionFile, SubmissionFileListProps, FileValidationError } from './submission-file-list';
