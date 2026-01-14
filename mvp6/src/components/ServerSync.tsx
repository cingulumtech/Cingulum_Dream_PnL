import React, { useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAppStore } from '../store/appStore'

export function ServerSync() {
  const template = useAppStore(s => s.template)
  const reportConfig = useAppStore(s => s.reportConfig)
  const defaults = useAppStore(s => s.defaults)
  const hydrated = useAppStore(s => s.hydrated)
  const setTemplateSaveStatus = useAppStore(s => s.setTemplateSaveStatus)
  const setReportSaveStatus = useAppStore(s => s.setReportSaveStatus)
  const setSettingsSaveStatus = useAppStore(s => s.setSettingsSaveStatus)

  const templateTimer = useRef<number | null>(null)
  const reportTimer = useRef<number | null>(null)
  const settingsTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!hydrated) return
    if (templateTimer.current) window.clearTimeout(templateTimer.current)
    setTemplateSaveStatus('saving')
    templateTimer.current = window.setTimeout(async () => {
      try {
        await api.saveTemplate({ name: template.name ?? 'Default template', data: template as any })
        setTemplateSaveStatus('saved')
      } catch {
        setTemplateSaveStatus('error')
      }
    }, 900)
    return () => {
      if (templateTimer.current) window.clearTimeout(templateTimer.current)
    }
  }, [template, hydrated, setTemplateSaveStatus])

  useEffect(() => {
    if (!hydrated) return
    if (reportTimer.current) window.clearTimeout(reportTimer.current)
    setReportSaveStatus('saving')
    reportTimer.current = window.setTimeout(async () => {
      try {
        await api.saveReport({ name: 'Report config', data: reportConfig as any })
        setReportSaveStatus('saved')
      } catch {
        setReportSaveStatus('error')
      }
    }, 900)
    return () => {
      if (reportTimer.current) window.clearTimeout(reportTimer.current)
    }
  }, [reportConfig, hydrated, setReportSaveStatus])

  useEffect(() => {
    if (!hydrated) return
    if (settingsTimer.current) window.clearTimeout(settingsTimer.current)
    setSettingsSaveStatus('saving')
    settingsTimer.current = window.setTimeout(async () => {
      try {
        await api.saveSettings({ name: 'User defaults', data: defaults as any })
        setSettingsSaveStatus('saved')
      } catch {
        setSettingsSaveStatus('error')
      }
    }, 900)
    return () => {
      if (settingsTimer.current) window.clearTimeout(settingsTimer.current)
    }
  }, [defaults, hydrated, setSettingsSaveStatus])

  return null
}
