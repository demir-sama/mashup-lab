import { Component, type ReactNode } from 'react'

type State = { err: Error | null }

/** Last-resort safety net: a crash in the UI shows a friendly reload card instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { err: null }
  static getDerivedStateFromError(err: Error): State {
    return { err }
  }
  componentDidCatch(err: Error) {
    console.error('[mashup-lab] UI error', err)
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="crash" role="alert">
        <h1>Oh no, the lab sneezed!</h1>
        <p>Something went wrong. Your monsters are safe: progress is saved automatically.</p>
        <button className="btn btn-slime btn-lg" onClick={() => location.reload()}>
          <span>Reload the lab</span>
        </button>
      </div>
    )
  }
}
