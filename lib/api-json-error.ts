import { NextResponse } from 'next/server'
import type { ApiErrorCode } from './api-error-codes'

export function apiJsonError(code: ApiErrorCode, status: number) {
  return NextResponse.json({ code }, { status })
}
