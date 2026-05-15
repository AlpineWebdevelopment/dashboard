'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Page } from './supabase'

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured')
  return createClient(url, key)
}

export async function getPages(): Promise<Page[]> {
  try {
    const { data, error } = await db()
      .from('pages')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  } catch {
    return []
  }
}

export async function getPage(id: string): Promise<Page | null> {
  try {
    const { data, error } = await db()
      .from('pages')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  } catch {
    return null
  }
}

export async function createPage() {
  let id: string
  try {
    const { data, error } = await db()
      .from('pages')
      .insert({ title: 'Untitled', content: '' })
      .select('id')
      .single()
    if (error) throw error
    id = data.id
  } catch (e) {
    throw e
  }
  revalidatePath('/pages')
  redirect(`/pages/${id}`)
}

export async function savePage(id: string, title: string, content: string) {
  const { error } = await db()
    .from('pages')
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pages')
  revalidatePath(`/pages/${id}`)
}

export async function deletePage(id: string) {
  const { error } = await db().from('pages').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/pages')
  redirect('/pages')
}
