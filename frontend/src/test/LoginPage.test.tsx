import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from '@/pages/LoginPage'

const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockClearError = vi.fn()

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    login: mockLogin,
    register: mockRegister,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email, password, and submit button', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('switching to signup shows full name and confirm password', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByText('Sign Up'))
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('••••••••')).toHaveLength(2)
  })
})
