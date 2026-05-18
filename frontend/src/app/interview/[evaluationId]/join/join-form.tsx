"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useJoinEvaluation } from "@/lib/api/mutations";
import { persistInterviewSession } from "@/lib/session/interview";

const schema = z.object({
  participant_name: z.string().trim().min(1, "지원자 이름을 입력하세요."),
  room_password: z.string().min(1, "학생 입장 비밀번호를 입력하세요."),
});

type FormValues = z.infer<typeof schema>;

interface JoinFormProps {
  evaluationId: string;
}

export function JoinForm({ evaluationId }: JoinFormProps) {
  const router = useRouter();
  const mutation = useJoinEvaluation(evaluationId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { participant_name: "", room_password: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const join = await mutation.mutateAsync({
        participant_name: values.participant_name,
        room_password: values.room_password,
      });
      const session = join.session;
      if (!session?.session_token) {
        toast.error("세션 토큰을 받지 못했습니다. 관리자에게 문의하세요.");
        return;
      }
      await persistInterviewSession({
        evaluationId,
        sessionId: session.id,
        sessionToken: session.session_token,
      });
      toast.success("입장이 확인되었습니다. 인터뷰를 시작합니다.");
      router.push(`/interview/${evaluationId}/session/${session.id}`);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "입장에 실패했습니다.";
      toast.error(message);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-serif text-3xl">인터뷰 입장</CardTitle>
        <p className="text-sm text-muted-foreground">
          관리자가 안내한 학생 입장 비밀번호와 사용할 이름을 입력하세요. 한 번 시작한
          인터뷰는 동일한 세션으로만 이어집니다.
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          평가 ID · {evaluationId}
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="participant_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="리포트에 기록될 이름"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "확인 중…" : "인터뷰 시작"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
