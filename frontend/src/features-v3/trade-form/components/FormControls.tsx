import { forwardRef } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/new-ui'

interface FieldShellProps {
  label: string
  required?: boolean
  error?: string
  help?: string
  children: ReactNode
  htmlFor?: string
}

function FieldShell({ label, required, error, help, children, htmlFor }: FieldShellProps) {
  return (
    <label className="tjv3-formfield" htmlFor={htmlFor}>
      <span className={cn('tjv3-formfield__label', required && 'tjv3-formfield__label--req')}>{label}</span>
      {children}
      {error && <span className="tjv3-formfield__error">{error}</span>}
      {!error && help && <span className="tjv3-formfield__help">{help}</span>}
    </label>
  )
}

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  required?: boolean
  error?: string
  help?: string
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, required, error, help, className, ...props }, ref) => (
    <FieldShell label={label} required={required} error={error} help={help}>
      <input
        ref={ref}
        className={cn('tjv3-formfield__control', error && 'tjv3-formfield__control--error', className)}
        {...props}
      />
    </FieldShell>
  ),
)
FormInput.displayName = 'FormInput'

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  required?: boolean
  error?: string
  help?: string
  options: { value: string; label: string }[]
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, required, error, help, options, className, ...props }, ref) => (
    <FieldShell label={label} required={required} error={error} help={help}>
      <select
        ref={ref}
        className={cn('tjv3-formfield__control', error && 'tjv3-formfield__control--error', className)}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  ),
)
FormSelect.displayName = 'FormSelect'

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
  help?: string
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, help, className, ...props }, ref) => (
    <FieldShell label={label} error={error} help={help}>
      <textarea
        ref={ref}
        className={cn('tjv3-formfield__control', error && 'tjv3-formfield__control--error', className)}
        {...props}
      />
    </FieldShell>
  ),
)
FormTextarea.displayName = 'FormTextarea'
