"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { ApiError } from "@/lib/api/client";
import { useCreateEvaluation } from "@/lib/api/mutations";
import { writeAdminPassword } from "@/lib/session/admin";
import { useWizardState } from "@/lib/wizard/state";

const schema = z.object({
  room_name: z.string().trim().min(1, "방 이름을 입력하세요."),
  project_name: z.string().trim().min(1, "프로젝트명을 입력하세요."),
  candidate_name: z.string().trim(),
  description: z.string().trim(),
  room_password: z.string().min(4, "학생 입장 비밀번호는 4자 이상으로 정해주세요."),
  admin_password: z.string().min(4, "평가자 비밀번호는 4자 이상으로 정해주세요."),
});

type FormValues = z.infer<typeof schema>;

export default function WizardStep1Page() {
  const router = useRouter();
  const { evaluationId, info, setEvaluation, reset } = useWizardState();
  const mutation = useCreateEvaluation();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      room_name: info?.room_name ?? "",
      project_name: info?.project_name ?? "",
      candidate_name: info?.candidate_name ?? "",
      description: info?.description ?? "",
      room_password: info?.room_password ?? "",
      admin_password: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const created = await mutation.mutateAsync({
        project_name: values.project_name,
        candidate_name: values.candidate_name,
        description: values.description,
        room_name: values.room_name || values.project_name,
        room_password: values.room_password,
        admin_password: values.admin_password,
      });
      writeAdminPassword(created.id, values.admin_password);
      setEvaluation(created.id, {
        room_name: created.room_name || values.project_name,
        project_name: created.project_name,
        candidate_name: created.candidate_name,
        description: created.description,
        room_password: values.room_password,
      });
      toast.success(`방을 만들었습니다. (ID ${created.id.slice(0, 8)}…)`);
      router.push("/create/step-2-upload");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "방 생성에 실패했습니다.";
      toast.error(message);
    }
  }

  function onReset() {
    reset();
    form.reset({
      room_name: "",
      project_name: "",
      candidate_name: "",
      description: "",
      room_password: "",
      admin_password: "",
    });
    toast.message("마법사 초기화 완료. 새 방을 만들 준비가 되었습니다.");
  }

  return (
    <WizardShell
      step={1}
      title="방을 정의하세요."
      description={
        <>
          <p>
            방 이름, 프로젝트 정보, 지원자 라벨을 입력합니다. 평가자 비밀번호는 이
            단계 이후 다시 볼 수 없으니 안전한 곳에 보관하세요.
          </p>
          <p className="mt-3 text-sm">
            학생은 평가 ID와 학생 입장 비밀번호로 접속합니다. 두 값은 마지막 단계에서
            함께 공유됩니다.
          </p>
        </>
      }
      previousLabel="홈"
      nextLabel="자료 업로드"
      actions={
        <>
          {evaluationId && (
            <Button type="button" variant="ghost" onClick={onReset}>
              마법사 초기화
            </Button>
          )}
          <Button
            type="submit"
            form="wizard-step-1-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "방을 만드는 중…" : "다음 단계"}
          </Button>
        </>
      }
    >
      {evaluationId && (
        <p className="rounded-md border border-dashed border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          이미 마법사가 평가 ID
          <span className="ml-1 font-mono text-foreground">{evaluationId}</span>
          와 연결되어 있습니다. 새 방을 만들려면 우측 하단의 “마법사 초기화”를
          누르세요. 같은 정보로 진행하려면 다음 단계로 넘어가세요.
        </p>
      )}

      <Form {...form}>
        <form
          id="wizard-step-1-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="room_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>방 / 시험 이름</FormLabel>
                <FormControl>
                  <Input placeholder="예: 캡스톤 4조 프로젝트 검증" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="project_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>프로젝트명</FormLabel>
                <FormControl>
                  <Input placeholder="예: 프로젝트 수행 진위 평가 서비스" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="candidate_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>지원자 / 팀 라벨</FormLabel>
                <FormControl>
                  <Input placeholder="예: 4조" {...field} />
                </FormControl>
                <FormDescription>
                  리포트와 관리 콘솔에서 이 라벨로 평가를 구분합니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>프로젝트 설명</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="핵심 기능과 제출 자료 범위를 간단히 적어주세요."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="room_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>학생 입장 비밀번호</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="admin_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>평가자 비밀번호</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>이 단계 이후 다시 표시되지 않습니다.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </WizardShell>
  );
}
