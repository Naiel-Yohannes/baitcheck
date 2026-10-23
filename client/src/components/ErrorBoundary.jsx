import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-8 text-gray-100">
          <section className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6 text-center shadow-xl">
            <p className="text-lg font-semibold">Something went wrong. Please reload the page.</p>
            <p className="mt-2 text-lg font-semibold" lang="am">ችግር ተፈጥሯል። እባክዎ ገጹን እንደገና ይጫኑ።</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500"
            >
              Reload page
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
