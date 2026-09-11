import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams;
  const message = resolvedSearchParams?.message;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-zinc-900 dark:text-white">
            لوحة التحكم
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            تسجيل الدخول للإدارة
          </p>
        </div>
        
        {message && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg text-center font-medium">
            {message}
          </div>
        )}

        <form className="mt-8 space-y-6" action={login}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                البريد الإلكتروني
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                placeholder="admin@example.com"
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                كلمة المرور
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-blue-500/40"
            >
              تسجيل الدخول
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
