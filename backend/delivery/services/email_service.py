from pathlib import Path
from email.message import EmailMessage
import mimetypes
import smtplib

from django.conf import settings


class EmailDeliveryError(Exception):
    """Raised when email delivery fails."""
    pass


class EmailService:
    """
    Handles SMTP email delivery.

    SMTP credentials are read from Django settings,
    which should ultimately come from environment variables.
    """

    def __init__(self):
        self.host = getattr(
            settings,
            "EMAIL_HOST",
            "",
        )

        self.port = int(
            getattr(
                settings,
                "EMAIL_PORT",
                587,
            )
        )

        self.username = getattr(
            settings,
            "EMAIL_HOST_USER",
            "",
        )

        self.password = getattr(
            settings,
            "EMAIL_HOST_PASSWORD",
            "",
        )

        self.use_tls = getattr(
            settings,
            "EMAIL_USE_TLS",
            True,
        )

        self.use_ssl = getattr(
            settings,
            "EMAIL_USE_SSL",
            False,
        )

        self.from_email = getattr(
            settings,
            "DEFAULT_FROM_EMAIL",
            self.username,
        )

    # ==========================================================
    # VALIDATION
    # ==========================================================

    def validate_configuration(self):
        """
        Validate SMTP configuration before sending.
        """

        if not self.host:
            raise EmailDeliveryError(
                "EMAIL_HOST is not configured."
            )

        if not self.port:
            raise EmailDeliveryError(
                "EMAIL_PORT is not configured."
            )

        if not self.from_email:
            raise EmailDeliveryError(
                "DEFAULT_FROM_EMAIL is not configured."
            )

        if self.use_tls and self.use_ssl:
            raise EmailDeliveryError(
                "EMAIL_USE_TLS and EMAIL_USE_SSL "
                "cannot both be enabled."
            )

        return True

    # ==========================================================
    # RECIPIENT VALIDATION
    # ==========================================================

    @staticmethod
    def normalize_recipients(
        recipients,
    ):
        """
        Normalize recipient emails.

        Accepts:

        [
            "one@example.com",
            "two@example.com"
        ]

        or:

        "one@example.com,two@example.com"
        """

        if isinstance(
            recipients,
            str,
        ):
            recipients = recipients.split(",")

        recipients = recipients or []

        normalized = []

        for recipient in recipients:
            email = str(
                recipient
            ).strip()

            if not email:
                continue

            if (
                "@" not in email
                or "." not in email.split(
                    "@"
                )[-1]
            ):
                raise EmailDeliveryError(
                    f"Invalid recipient email: {email}"
                )

            if email not in normalized:
                normalized.append(email)

        if not normalized:
            raise EmailDeliveryError(
                "At least one recipient email is required."
            )

        return normalized

    # ==========================================================
    # SEND EMAIL
    # ==========================================================

    def send(
        self,
        recipients,
        subject,
        body,
        attachment_path=None,
    ):
        """
        Send an email through SMTP.

        Returns delivery metadata.
        """

        self.validate_configuration()

        recipients = self.normalize_recipients(
            recipients
        )

        if not subject:
            raise EmailDeliveryError(
                "Email subject is required."
            )

        if not body:
            body = (
                "Please find the application "
                "logs attached."
            )

        message = EmailMessage()

        message["From"] = self.from_email
        message["To"] = ", ".join(
            recipients
        )
        message["Subject"] = subject

        message.set_content(body)

        # ------------------------------------------------------
        # Attachment
        # ------------------------------------------------------

        if attachment_path:
            attachment = Path(
                attachment_path
            )

            if not attachment.exists():
                raise EmailDeliveryError(
                    f"Attachment does not exist: "
                    f"{attachment}"
                )

            if not attachment.is_file():
                raise EmailDeliveryError(
                    f"Attachment is not a file: "
                    f"{attachment}"
                )

            content_type, encoding = (
                mimetypes.guess_type(
                    str(attachment)
                )
            )

            if content_type is None:
                content_type = (
                    "application/octet-stream"
                )

            maintype, subtype = (
                content_type.split(
                    "/",
                    1,
                )
            )

            with attachment.open(
                "rb"
            ) as file:
                message.add_attachment(
                    file.read(),
                    maintype=maintype,
                    subtype=subtype,
                    filename=attachment.name,
                )

        # ------------------------------------------------------
        # SMTP connection
        # ------------------------------------------------------

        try:
            if self.use_ssl:

                smtp = smtplib.SMTP_SSL(
                    self.host,
                    self.port,
                    timeout=30,
                )

            else:

                smtp = smtplib.SMTP(
                    self.host,
                    self.port,
                    timeout=30,
                )

            with smtp:

                smtp.ehlo()

                if self.use_tls:
                    smtp.starttls()
                    smtp.ehlo()

                if self.username:
                    smtp.login(
                        self.username,
                        self.password,
                    )

                smtp.send_message(
                    message
                )

        except smtplib.SMTPAuthenticationError as exc:
            raise EmailDeliveryError(
                "SMTP authentication failed. "
                "Check EMAIL_HOST_USER and "
                "EMAIL_HOST_PASSWORD."
            ) from exc

        except smtplib.SMTPConnectError as exc:
            raise EmailDeliveryError(
                f"Unable to connect to SMTP server: "
                f"{self.host}:{self.port}"
            ) from exc

        except smtplib.SMTPException as exc:
            raise EmailDeliveryError(
                f"SMTP delivery failed: {exc}"
            ) from exc

        except OSError as exc:
            raise EmailDeliveryError(
                f"Unable to connect to email server: "
                f"{exc}"
            ) from exc

        return {
            "status": "SENT",
            "recipients": recipients,
            "subject": subject,
            "attachment": (
                str(attachment_path)
                if attachment_path
                else None
            ),
        }

    # ==========================================================
    # SMTP CONNECTION TEST
    # ==========================================================

    def test_connection(self):
        """
        Test SMTP connectivity and authentication
        without sending an email.
        """

        self.validate_configuration()

        try:
            if self.use_ssl:

                smtp = smtplib.SMTP_SSL(
                    self.host,
                    self.port,
                    timeout=30,
                )

            else:

                smtp = smtplib.SMTP(
                    self.host,
                    self.port,
                    timeout=30,
                )

            with smtp:

                smtp.ehlo()

                if self.use_tls:
                    smtp.starttls()
                    smtp.ehlo()

                if self.username:
                    smtp.login(
                        self.username,
                        self.password,
                    )

            return {
                "status": "CONNECTED",
                "message": (
                    "SMTP connection successful."
                ),
                "host": self.host,
                "port": self.port,
            }

        except smtplib.SMTPAuthenticationError as exc:
            raise EmailDeliveryError(
                "SMTP authentication failed."
            ) from exc

        except smtplib.SMTPException as exc:
            raise EmailDeliveryError(
                f"SMTP connection failed: {exc}"
            ) from exc

        except OSError as exc:
            raise EmailDeliveryError(
                f"Unable to connect to SMTP server: "
                f"{exc}"
            ) from exc