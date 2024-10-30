<script setup lang="ts">
import { Card, CardHeader, CardContent, CardFooter } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";


interface ContactFormeProps {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}

const contactForm = reactive<ContactFormeProps>({
  firstName: "",
  lastName: "",
  email: "",
  subject: "Web Development",
  message: "",
});

const invalidInputForm = ref<boolean>(false);

const handleSubmit = () => {
  const { firstName, lastName, email, subject, message } = contactForm;
  console.log(contactForm);

  const mailToLink = `mailto:leomirandadev@gmail.com?subject=${subject}&body=Hello I am ${firstName} ${lastName}, my Email is ${email}. %0D%0A${message}`;

  window.location.href = mailToLink;
};
</script>

<template>
  <section
    id="contact"
    class="container py-24 sm:py-32"
  >
    <section class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <div class="mb-4">
          <h2 class="text-lg text-primary mb-2 tracking-wider">Contact</h2>

          <h2 class="text-3xl md:text-4xl font-bold">Connect With Us</h2>
        </div>
        <p class="mb-8 text-muted-foreground lg:w-5/6">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptatum
          ipsam sint enim exercitationem ex autem corrupti quas tenetur
        </p>

        <div class="flex flex-col gap-4">
          <div>
            <div class="flex gap-2 mb-1">
              <Icon name="lucide:map-pin" />
              <div class="font-bold">Find Us</div>
            </div>

            <div>742 Evergreen Terrace, Springfield, IL 62704</div>
          </div>

          <div>
            <div class="flex gap-2 mb-1">
              <Icon name="lucide:phone" />
              <div class="font-bold">Call Us</div>
            </div>

            <div>+1 (619) 123-4567</div>
          </div>

          <div>
            <div class="flex gap-2 mb-1">
              <Icon name="lucide:mail" />
              <div class="font-bold">Mail Us</div>
            </div>

            <div>leomirandadev@gmail.com</div>
          </div>

          <div>
            <div class="flex gap-2">
              <Icon name="lucide:home" />
              <div class="font-bold">Visit Us</div>
            </div>

            <div>
              <div>Monday - Friday</div>
              <div>8AM - 4PM</div>
            </div>
          </div>
        </div>
      </div>

      <!-- form -->
      <Card class="bg-muted/60 dark:bg-card">
        <CardHeader class="text-primary text-2xl"/>
        <CardContent>
          <form
            class="grid gap-4"
            @submit.prevent="handleSubmit"
          >
            <div class="flex flex-col md:flex-row gap-8">
              <div class="flex flex-col w-full gap-1.5">
                <Label for="first-name">First Name</Label>
                <Input
                  id="first-name"
                  v-model="contactForm.firstName"
                  type="text"
                  placeholder="Leopoldo"
                />
              </div>

              <div class="flex flex-col w-full gap-1.5">
                <Label for="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  v-model="contactForm.lastName"
                  type="text"
                  placeholder="Miranda"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="contactForm.email"
                type="email"
                placeholder="leomirandadev@gmail.com"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="subject">Subject</Label>

              <Select v-model="contactForm.subject">
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Web Development">
                      Web Development
                    </SelectItem>
                    <SelectItem value="Mobile Development">
                      Mobile Development
                    </SelectItem>
                    <SelectItem value="Figma Design"> Figma Design </SelectItem>
                    <SelectItem value="REST API "> REST API </SelectItem>
                    <SelectItem value="FullStack Project">
                      FullStack Project
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div class="flex flex-col gap-1.5">
              <Label for="message">Message</Label>
              <Textarea
                id="message"
                v-model="contactForm.message"
                placeholder="Your message..."
                rows="5"
              />
            </div>

            <Alert
              v-if="invalidInputForm"
              variant="destructive"
            >
              <Icon name="lucide:alert-circle" class="w-4 h-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                There is an error in the form. Please check your input.
              </AlertDescription>
            </Alert>

            <Button class="mt-4">Send message</Button>
          </form>
        </CardContent>

        <CardFooter/>
      </Card>
    </section>
  </section>
</template>
