import React from 'react'

// Base shimmer block. Pass sizing/spacing via className (e.g. "h-4 w-32").
export function Skeleton({ className = '' }) {
  return <span className={`el-skeleton block ${className}`} />
}

// A stack of text-line placeholders; the last line is shortened for a natural look.
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

// Generic card placeholder used in dashboard/session grids.
function SkeletonCard() {
  return (
    <div className="el-card flex flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
    </div>
  )
}

// Simple list-row placeholders for modals (collaborators, invitations, etc.).
export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )
}

// Shared page header bar placeholder.
function PageHeaderSkeleton() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </header>
  )
}

// Full-page skeleton for the Dashboard (toolbar + grid of session cards).
export function DashboardSkeleton() {
  return (
    <div className="el-app-bg pb-12">
      <PageHeaderSkeleton />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="el-card mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  )
}

// Full-page skeleton for a session view (banner + stats + room cards).
export function SessionViewSkeleton() {
  return (
    <div className="el-app-bg pb-12">
      <PageHeaderSkeleton />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="el-card mb-5 p-5">
          <Skeleton className="h-6 w-56" />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  )
}

// Full-page skeleton for the session detail page.
export function SessionDetailSkeleton() {
  return (
    <div className="el-app-bg pb-12">
      <PageHeaderSkeleton />
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="el-card p-5">
          <Skeleton className="h-6 w-48" />
          <SkeletonText lines={2} className="mt-4 max-w-xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  )
}

// Full-page skeleton for the room detail page (main column + sidebar).
export function RoomDetailSkeleton() {
  return (
    <div className="el-app-bg pb-12">
      <PageHeaderSkeleton />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-5 lg:col-span-2">
          <div className="el-card p-5">
            <Skeleton className="h-6 w-40" />
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-6 w-10" />
                </div>
              ))}
            </div>
          </div>
          <div className="el-card p-5">
            <Skeleton className="h-5 w-36" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="el-card p-5">
            <Skeleton className="h-5 w-28" />
            <SkeletonText lines={4} className="mt-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Skeleton
