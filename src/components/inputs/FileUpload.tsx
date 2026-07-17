import { Component, createSignal, For, Show, splitProps, onMount, onCleanup } from 'solid-js';
import { BsCloudUpload, BsUpload } from 'solid-icons/bs';
import { Progress } from '../feedback/Progress';
import { Chip } from '../display/Chip';
import { useFormField } from '../../contexts/FormFieldContext';
import '../../styles/components/inputs/FileUpload.css';

interface FileUploadProps {
  value?: File[];
  onChange?: (files: File[]) => void;
  onBlur?: () => void;
  onError?: (message: string) => void;
  /** 'dropzone' shows a large bordered drop area; 'button' shows a compact browse button */
  variant?: 'dropzone' | 'button';
  size?: 'normal' | 'compact';
  label?: string;
  error?: string;
  invalid?: boolean;
  required?: boolean;
  /** Allow selecting multiple files */
  multiple?: boolean;
  /** Native file input accept attribute, e.g. "image/*,.pdf" */
  accept?: string;
  /** Maximum file size in bytes per file */
  maxSize?: number;
  /** Maximum number of files (only applies when multiple=true) */
  maxFiles?: number;
  /** Upload progress 0 to 100; renders a linear Progress bar when defined */
  progress?: number;
  disabled?: boolean;
  name?: string;
  id?: string;
  class?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-labelledby'?: string;
}

const formatSize = (bytes: number): string => {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
};

const isFileAccepted = (file: File, accept: string): boolean => {
  const types = accept.split(',').map((a) => a.trim());
  return types.some((type) => {
    if (type === '*/*') return true;
    if (type.endsWith('/*')) {
      const [category] = type.split('/');
      return file.type.startsWith(`${category}/`);
    }
    if (type.startsWith('.')) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    return file.type === type;
  });
};

export const FileUpload: Component<FileUploadProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'value',
    'onChange',
    'onBlur',
    'onError',
    'variant',
    'size',
    'label',
    'error',
    'invalid',
    'required',
    'multiple',
    'accept',
    'maxSize',
    'maxFiles',
    'progress',
    'disabled',
    'name',
    'id',
    'class',
    'aria-describedby',
    'aria-required',
    'aria-labelledby',
  ]);

  const [isDragging, setIsDragging] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let dropzoneRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;
  let dragCounter = 0;

  const variant = () => local.variant ?? 'dropzone';
  const size = () => local.size ?? 'normal';
  const selectedFiles = () => local.value ?? [];

  const fieldCtx = useFormField();
  const inputId = () => local.id ?? fieldCtx?.fieldId ?? local.name;
  const ariaDescribedBy = () => local['aria-describedby'] ?? fieldCtx?.ariaDescribedBy?.();
  const ariaRequired = () => local['aria-required'] ?? local.required ?? fieldCtx?.required;

  const processFiles = (incoming: File[]) => {
    if (!local.onChange) return;

    const errors: string[] = [];
    let valid = incoming;

    if (local.accept) {
      const rejected = valid.filter((f) => !isFileAccepted(f, local.accept!));
      if (rejected.length > 0) {
        errors.push(
          `${rejected.map((f) => f.name).join(', ')} ${rejected.length === 1 ? 'is' : 'are'} not an accepted file type.`
        );
        valid = valid.filter((f) => isFileAccepted(f, local.accept!));
      }
    }

    if (local.maxSize !== undefined) {
      const oversized = valid.filter((f) => f.size > local.maxSize!);
      if (oversized.length > 0) {
        errors.push(
          `${oversized.map((f) => f.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} the maximum size of ${formatSize(local.maxSize)}.`
        );
        valid = valid.filter((f) => f.size <= local.maxSize!);
      }
    }

    if (!local.multiple) {
      valid = valid.slice(0, 1);
    }

    let merged = local.multiple ? [...selectedFiles(), ...valid] : valid;

    if (local.multiple && local.maxFiles !== undefined && merged.length > local.maxFiles) {
      const excess = merged.length - local.maxFiles;
      errors.push(
        `Maximum ${local.maxFiles} file${local.maxFiles === 1 ? '' : 's'} allowed; ${excess} file${excess === 1 ? '' : 's'} skipped.`
      );
      merged = merged.slice(0, local.maxFiles);
    }

    if (errors.length > 0 && local.onError) {
      local.onError(errors.join(' '));
    }

    local.onChange(merged);
  };

  const openFilePicker = () => {
    if (local.disabled) return;
    inputRef?.click();
  };

  const handleInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length > 0) processFiles(files);
    // Reset so the same file can be re-selected
    input.value = '';
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (local.disabled) return;
    dragCounter++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounter = 0;
    setIsDragging(false);
    if (local.disabled) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) processFiles(files);
  };

  // Paste is handled at the document level so that the hovered instance wins,
  // even without keyboard focus. Fallback: whichever element has focus also works.
  const handleDocumentPaste = (e: ClipboardEvent) => {
    if (local.disabled) return;
    const isFocused =
      document.activeElement === dropzoneRef ||
      document.activeElement === buttonRef;
    if (!isHovered() && !isFocused) return;
    const items = Array.from(e.clipboardData?.items ?? []);
    const files = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  onMount(() => document.addEventListener('paste', handleDocumentPaste));
  onCleanup(() => document.removeEventListener('paste', handleDocumentPaste));

  const removeFile = (file: File) => {
    if (!local.onChange) return;
    local.onChange(selectedFiles().filter((f) => f !== file));
  };

  const containerClass = () => {
    const classes = ['file-upload', `file-upload--${variant()}`];
    if (size() === 'compact') classes.push('file-upload--compact');
    if (local.disabled) classes.push('file-upload--disabled');
    if (local.invalid || local.error) classes.push('file-upload--invalid');
    if (isDragging()) classes.push('file-upload--drag-over');
    if (local.class) classes.push(local.class);
    return classes.join(' ');
  };

  const constraintHint = () =>
    [
      local.accept ? `Accepts: ${local.accept}` : null,
      local.maxSize ? `Max size: ${formatSize(local.maxSize)}` : null,
      local.maxFiles && local.multiple ? `Up to ${local.maxFiles} file${local.maxFiles === 1 ? '' : 's'}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div class={containerClass()} {...rest}>
      <Show when={local.label}>
        <label class="file-upload__label" for={inputId()}>
          {local.label}
        </label>
      </Show>

      <input
        ref={inputRef}
        id={inputId()}
        name={local.name}
        type="file"
        accept={local.accept}
        multiple={local.multiple}
        disabled={local.disabled}
        required={local.required}
        class="file-upload__input"
        aria-label={local.label || 'File upload'}
        aria-invalid={local.invalid || !!local.error}
        aria-required={ariaRequired()}
        aria-describedby={ariaDescribedBy()}
        onChange={handleInputChange}
      />

      <Show when={variant() === 'dropzone'}>
        <div
          ref={dropzoneRef}
          class="file-upload__dropzone"
          onClick={openFilePicker}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onBlur={local.onBlur}
          role="button"
          tabIndex={local.disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFilePicker();
            }
          }}
          aria-disabled={local.disabled}
          aria-invalid={local.invalid || !!local.error}
          aria-required={ariaRequired()}
          aria-describedby={ariaDescribedBy()}
          aria-labelledby={local['aria-labelledby']}
        >
          <div class="file-upload__dropzone-icon">
            <BsCloudUpload />
          </div>
          <div class="file-upload__dropzone-text">
            <span class="file-upload__dropzone-primary">
              {isDragging() ? 'Drop files here' : 'Drag files here or click to browse'}
            </span>
            <Show when={constraintHint()}>
              <span class="file-upload__dropzone-hint">{constraintHint()}</span>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={variant() === 'button'}>
        <div
          class="file-upload__button-area"
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <button
            ref={buttonRef}
            type="button"
            class="file-upload__button"
            onClick={openFilePicker}
            onBlur={local.onBlur}
            disabled={local.disabled}
            aria-invalid={local.invalid || !!local.error}
            aria-required={ariaRequired()}
            aria-describedby={ariaDescribedBy()}
            aria-labelledby={local['aria-labelledby']}
          >
            <BsUpload />
            <span>Browse files</span>
          </button>
          <span class="file-upload__button-hint">
            {isDragging() ? 'Drop to upload' : 'or drag files here'}
          </span>
          <Show when={constraintHint()}>
            <span class="file-upload__button-constraint">{constraintHint()}</span>
          </Show>
        </div>
      </Show>

      <Show when={local.progress !== undefined}>
        <div class="file-upload__progress">
          <Progress type="linear" value={local.progress} variant="primary" />
        </div>
      </Show>

      <Show when={selectedFiles().length > 0}>
        <div class="file-upload__files">
          <For each={selectedFiles()}>
            {(file) => (
              <Chip onRemove={() => removeFile(file)} size={size()}>
                {file.name}
              </Chip>
            )}
          </For>
        </div>
      </Show>

      <Show when={local.error}>
        <span class="file-upload__error">{local.error}</span>
      </Show>
    </div>
  );
};
