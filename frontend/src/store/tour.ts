import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TourState {
  hasSeenTour: boolean
  currentStep: number
  isActive: boolean
  startTour: () => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: number) => void
  endTour: () => void
  resetTour: () => void
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasSeenTour: false,
      currentStep: 0,
      isActive: false,
      startTour: () => set({ isActive: true, currentStep: 0 }),
      nextStep: () => set((s) => ({ currentStep: s.currentStep + 1 })),
      prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
      goToStep: (step) => set({ currentStep: step }),
      endTour: () => set({ isActive: false, hasSeenTour: true, currentStep: 0 }),
      resetTour: () => set({ hasSeenTour: false, isActive: false, currentStep: 0 }),
    }),
    {
      name: 'lernvo-tour',
      partialize: (s) => ({ hasSeenTour: s.hasSeenTour }),
    }
  )
)
