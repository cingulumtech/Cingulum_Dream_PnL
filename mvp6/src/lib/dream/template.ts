import { DreamGroup, DreamLine, DreamTemplate } from '../types'

const line = (id: string, label: string, mappedAccounts: string[] = []): DreamLine => ({
  id,
  label,
  kind: 'line',
  mappedAccounts,
})

const group = (id: string, label: string, children: (DreamGroup | DreamLine)[]): DreamGroup => ({
  id,
  label,
  kind: 'group',
  children,
})

/**
 * Built-in Accounting Atlas template (editable in-app).
 * This is based on the financial layout you supplied, including:
 * - Board / Investor View
 * - Revenue / Cost of Sales / Operating Expenses
 * - Sub-groups (Payroll, Premises, Technology, etc.)
 */
export const DEFAULT_DREAM_TEMPLATE: DreamTemplate = {
  id: 'dream_v1',
  name: 'Accounting Atlas (Board / Investor View)',
  root: group('root', 'Accounting Atlas', [
    group('rev', 'Revenue', [
      line('rev_cba', 'CBA - Program Revenue'),
      line('rev_tms', 'cgTMS - Program Revenue'),
      line('rev_adj', 'Adjunct Therapies - Revenue'),
      line('rev_consult', 'Non-TMS Consultations - Revenue'),
    ]),
    group('cogs', 'Cost of Sales', [
      group('cogs_cba', 'CBA Cost of Sales', [
        line('cogs_cba_doc', 'CBA - Doctor Consultations'),
        line('cogs_cba_qt', 'CBA - Neuroimaging Processing (Quicktome)'),
        line('cogs_cba_creyos', 'CBA - Cognitive Assessments (Creyos)'),
        line('cogs_cba_radio', 'Radiology Services (Patient Scans)'),
      ]),
      group('cogs_tms', 'cgTMS Cost of Sales', [
        line('cogs_tms_oversight', 'cgTMS - Medical Oversight & Reviews'),
        line('cogs_tms_cons', 'cgTMS - Treatment Consumables'),
        line('cogs_tms_img', 'cgTMS - Post-Treatment Imaging Processing'),
        line('cogs_tms_cog', 'cgTMS - Post-Treatment Cognitive Assessments'),
      ]),
      group('cogs_other', 'Adjunct & Other Direct Costs', [
        line('cogs_adj_ext', 'Adjunct Therapies - External Providers & Practitioners'),
        line('cogs_non_tms_doc', 'Non-TMS Doctor Consultations'),
      ]),
    ]),
    group('opex', 'Operating Expenses', [
      group('opex_payroll', 'Payroll', [
        line('opex_payroll_clin', 'Wages - Clinical Team'),
        line('opex_payroll_admin', 'Wages - Administration'),
        line('opex_payroll_super', 'Superannuation'),
        line('opex_payroll_proc', 'Payroll Processing & Compliance'),
        line('opex_payroll_tax', 'Payroll Tax'),
      ]),
      group('opex_prem', 'Premises', [
        line('opex_prem_rent', 'Clinic Rent & Outgoings'),
        line('opex_prem_utils', 'Utilities & Connectivity'),
        line('opex_prem_clean', 'Cleaning & Premises Maintenance'),
        line('opex_prem_services', 'Facility Services (Pest Control, Safety, Testing, Security)'),
        line('opex_prem_decor', 'Clinic Decor & Non-Capital Fitout'),
      ]),
      group('opex_tech', 'Technology', [
        line('opex_tech_clin', 'Clinical Systems & Practice Software'),
        line('opex_tech_admin', 'Administrative & Productivity Clinic Software'),
        line('opex_tech_support', 'IT & Tech Support Software'),
        line('opex_tech_contract', 'IT Contractors & Development'),
        line('opex_tech_telco', 'Telecommunications & Connectivity'),
        line('opex_tech_hw', 'IT Equipment & Hardware (Non-Capital)'),
      ]),
      group('opex_mkt', 'Marketing', [
        line('opex_mkt_acq', 'Marketing & Patient Acquisition'),
        line('opex_mkt_coll', 'Printing, Signage & Marketing Collateral'),
      ]),
      group('opex_prof', 'Professional & Compliance', [
        line('opex_prof_fees', 'Accounting, Legal & Professional Fees'),
        line('opex_prof_ins', 'Insurance'),
        line('opex_prof_regs', 'Regulatory, Registrations & Government Fees'),
      ]),
      group('opex_ops', 'Operations', [
        line('opex_ops_meals', 'Meals & Entertainment'),
        line('opex_ops_train', 'Training, Conferences & Professional Development'),
        line('opex_ops_supplies', 'Clinic Supplies (Operational Consumables)'),
        line('opex_ops_furn', 'Office Furniture, Fixtures & Non-Consumables'),
        line('opex_ops_post', 'Postage & Courier'),
      ]),
      group('opex_people', 'People & Culture', [
        line('opex_people_uniform', 'Staff Uniforms & Apparel'),
        line('opex_people_gifts', 'Gifts, Recognition & Goodwill'),
      ]),
      group('opex_clin', 'Clinical Operating Expenses', [
        line('opex_clin_equip', 'Clinical Equipment & Reusable Items'),
        line('opex_clin_prov', 'Clinical Equipment & Service Providers'),
        line('opex_clin_train', 'Training, Education & Clinical Accreditation'),
      ]),
      group('opex_fin', 'Finance & Non-Cash', [
        line('opex_fin_bank', 'Banking & Payment Processing Fees'),
        line('opex_fin_logic', 'Payment Logic & Rewards Acceleration Fees'),
        line('opex_fin_int', 'Interest Expense'),
        line('opex_fin_dep', 'Depreciation & Amortisation'),
      ]),
      group('opex_group', 'Group Charges', [
        line('opex_group_roy', 'GROUP - Royalty & Licensing Fee (cgTMS Revenue Based)'),
      ]),
    ]),
  ]),
}
