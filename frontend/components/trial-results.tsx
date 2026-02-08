'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { MatchResponse, TrialMatch, PatientCriteria } from '@/lib/api';
import {
  IconExternalLink,
  IconRefresh,
  IconUser,
  IconStethoscope,
  IconPill,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';

interface TrialResultsProps {
  response: MatchResponse;
  onNewSearch: () => void;
}

export function TrialResults({ response, onNewSearch }: TrialResultsProps) {
  const { patient_criteria, results } = response;

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      {/* Patient criteria summary */}
      <PatientSummary criteria={patient_criteria} />

      {/* Results header */}
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <h2 className="text-base font-semibold sm:text-lg">
            Matching Clinical Trials
          </h2>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            {results.length} trial{results.length !== 1 ? 's' : ''} found,
            ranked by relevance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onNewSearch} className="shrink-0">
          <IconRefresh className="h-4 w-4" />
          <span className="hidden sm:inline">New Search</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Trial cards */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center sm:py-12">
            <p className="text-xs text-muted-foreground sm:text-sm">
              No matching clinical trials found.
              Try adjusting the patient information and searching again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {results.map((trial, index) => (
            <TrialCard key={trial.id} trial={trial} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function PatientSummary({ criteria }: { criteria: PatientCriteria }) {
  const [expanded, setExpanded] = React.useState(false);

  const hasData =
    criteria.conditions?.length > 0 ||
    criteria.medications?.length > 0 ||
    criteria.age ||
    criteria.sex;

  if (!hasData) return null;

  return (
    <Card size="sm">
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
          <IconUser className="h-4 w-4 shrink-0 text-primary" />
          Extracted Patient Profile
        </CardTitle>
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute right-3 top-3 p-1 text-muted-foreground hover:text-foreground sm:right-4 sm:top-4"
        >
          {expanded ? (
            <IconChevronUp className="h-4 w-4" />
          ) : (
            <IconChevronDown className="h-4 w-4" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="px-3 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {(criteria.age || criteria.sex) && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Demographics</p>
                <p className="text-xs sm:text-sm">
                  {[criteria.age && `Age: ${criteria.age}`, criteria.sex]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              </div>
            )}
            {criteria.conditions?.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Conditions</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {criteria.conditions.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] sm:text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {criteria.medications?.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Medications</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {criteria.medications.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] sm:text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {criteria.allergies?.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Allergies</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {criteria.allergies.map((a, i) => (
                    <Badge key={i} variant="destructive" className="text-[10px] sm:text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function TrialCard({ trial, rank }: { trial: TrialMatch; rank: number }) {
  const [expanded, setExpanded] = React.useState(false);

  const scoreColor =
    trial.score !== null
      ? trial.score >= 75
        ? 'text-green-600 dark:text-green-400'
        : trial.score >= 50
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-muted-foreground'
      : '';

  const statusColor =
    trial.study_status?.toLowerCase().includes('recruiting')
      ? 'default'
      : trial.study_status?.toLowerCase().includes('completed')
      ? 'secondary'
      : ('outline' as const);

  return (
    <Card>
      <CardHeader className="px-3 sm:px-6">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary sm:h-7 sm:w-7 sm:text-xs">
            {rank}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xs leading-snug sm:text-sm">
              {trial.study_title || trial.id}
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1 sm:mt-1.5 sm:gap-1.5">
              {trial.study_status && (
                <Badge variant={statusColor} className="text-[9px] sm:text-[10px]">
                  {trial.study_status}
                </Badge>
              )}
              {trial.phases && (
                <Badge variant="outline" className="text-[9px] sm:text-[10px]">
                  {trial.phases}
                </Badge>
              )}
              {trial.score !== null && (
                <span className={`text-[10px] font-medium ${scoreColor}`}>
                  Match: {trial.score}%
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Match reasoning */}
      {trial.match_reasoning && (
        <CardContent className="px-3 pt-0 sm:px-6">
          <div className="rounded-lg bg-primary/5 px-2.5 py-2 sm:px-3">
            <p className="text-[10px] font-medium text-primary sm:text-xs">Why this matches:</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-foreground/80 sm:text-xs">
              {trial.match_reasoning}
            </p>
          </div>
        </CardContent>
      )}

      {/* Expandable details */}
      {expanded && (
        <CardContent className="space-y-3 px-3 pt-0 sm:px-6">
          <Separator />

          {trial.conditions && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Conditions</p>
              <p className="text-[11px] sm:text-xs">{trial.conditions}</p>
            </div>
          )}

          {trial.interventions && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Interventions</p>
              <p className="text-[11px] sm:text-xs">{trial.interventions}</p>
            </div>
          )}

          {trial.sponsor && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Sponsor</p>
              <p className="text-[11px] sm:text-xs">{trial.sponsor}</p>
            </div>
          )}

          {trial.brief_summary && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Summary</p>
              <p className="mt-1 max-h-32 overflow-y-auto text-[11px] leading-relaxed sm:max-h-40 sm:text-xs">
                {trial.brief_summary}
              </p>
            </div>
          )}
        </CardContent>
      )}

      <CardFooter className="flex items-center justify-between px-3 sm:px-6">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setExpanded(!expanded)}
          className="active:bg-muted"
        >
          {expanded ? (
            <>
              <IconChevronUp className="h-3 w-3" />
              Less
            </>
          ) : (
            <>
              <IconChevronDown className="h-3 w-3" />
              Details
            </>
          )}
        </Button>

        {trial.study_url && (
          <a
            href={trial.study_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-primary underline-offset-2 hover:underline active:bg-primary/5 sm:text-xs"
          >
            <span className="hidden sm:inline">ClinicalTrials.gov</span>
            <span className="sm:hidden">View Trial</span>
            <IconExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardFooter>
    </Card>
  );
}
