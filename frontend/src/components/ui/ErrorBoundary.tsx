import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 flex items-center justify-center">
          <div className="glass rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-loss mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-text-heading">Something went wrong</h2>
              <p className="text-sm text-text-muted mt-1">
                {this.props.name ? `${this.props.name} encountered an error.` : 'This section encountered an error.'}
              </p>
            </div>
            {this.state.error && (
              <pre className="text-xs text-left text-loss bg-bg/50 rounded-lg p-3 max-h-32 overflow-auto">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                         bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
