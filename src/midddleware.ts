import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        // remove の場合、値は空文字 "" などで処理します
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options }) // ここに value: '' を明示
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // セッションの取得（これが認証チェックの実体）
  const { data: { session } } = await supabase.auth.getSession()
  const isProtectedRoute = 
  request.nextUrl.pathname.startsWith('/board') || 
  request.nextUrl.pathname.startsWith('/profile');

  if (!session && isProtectedRoute) {
  return NextResponse.redirect(new URL('/login', request.url)); // /loginへ飛ばす
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}