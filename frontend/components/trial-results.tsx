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
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Patient criteria summary */}
      <PatientSummary criteria={patient_criteria} />

      {/* Results header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Matching Clinical Trials
          </h2>
          <p className="text-xs text-muted-foreground">
            {results.length} trial{results.length !== 1 ? 's' : ''} found,
            ranked by relevance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onNewSearch}>
          <IconRefresh className="h-4 w-4" />
          New Search
        </Button>
      </div>

      {/* Trial cards */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No clinical trials matched with sufficient confidence (above 30%).
              Try adjusting the patient information and searching again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <IconUser className="h-4 w-4 text-primary" />
          Extracted Patient Profile
        </CardTitle>
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <IconChevronUp className="h-4 w-4" />
          ) : (
            <IconChevronDown className="h-4 w-4" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {(criteria.age || criteria.sex) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Demographics</p>
                <p className="text-sm">
                  {[criteria.age && `Age: ${criteria.age}`, criteria.sex]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              </div>
            )}
            {criteria.conditions?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Conditions</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {criteria.conditions.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {criteria.medications?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Medications</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {criteria.medications.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {criteria.allergies?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Allergies</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {criteria.allergies.map((a, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">
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
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {rank}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm leading-snug">
              {trial.study_title || trial.id}
            </CardTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {trial.study_status && (
                <Badge variant={statusColor} className="text-[10px]">
                  {trial.study_status}
                </Badge>
              )}
              {trial.phases && (
                <Badge variant="outline" className="text-[10px]">
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
        <CardContent className="pt-0">
          <div className="rounded-lg bg-primary/5 px-3 py-2">
            <p className="text-xs font-medium text-primary">Why this matches:</p>
            <p className="mt-0.5 text-xs text-foreground/80">
              {trial.match_reasoning}
            </p>
          </div>
        </CardContent>
      )}

      {/* Expandable details */}
      {expanded && (
        <CardContent className="space-y-3 pt-0">
          <Separator />

          {trial.conditions && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Conditions</p>
              <p className="text-xs">{trial.conditions}</p>
            </div>
          )}

          {trial.interventions && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Interventions</p>
              <p className="text-xs">{trial.interventions}</p>
            </div>
          )}

          {trial.sponsor && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sponsor</p>
              <p className="text-xs">{trial.sponsor}</p>
            </div>
          )}

          {trial.brief_summary && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Summary</p>
              <p className="mt-1 max-h-40 overflow-y-auto text-xs leading-relaxed">
                {trial.brief_summary}
              </p>
            </div>
          )}
        </CardContent>
      )}

      <CardFooter className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setExpanded(!expanded)}
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
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
          >
            ClinicalTrials.gov
            <IconExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardFooter>
    </Card>
  );
}
